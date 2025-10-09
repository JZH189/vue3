import { isFunction } from '@vue/shared'
import {
  type DebuggerEvent,
  type DebuggerOptions,
  EffectFlags,
  type Subscriber,
  activeSub,
  batch,
  refreshComputed,
} from './effect'
import type { Ref } from './ref'
import { warn } from './warning'
import { Dep, type Link, globalVersion } from './dep'
import { ReactiveFlags, TrackOpTypes } from './constants'

declare const ComputedRefSymbol: unique symbol
declare const WritableComputedRefSymbol: unique symbol

interface BaseComputedRef<T, S = T> extends Ref<T, S> {
  [ComputedRefSymbol]: true
  /**
   * @deprecated computed no longer uses effect
   */
  effect: ComputedRefImpl
}

export interface ComputedRef<T = any> extends BaseComputedRef<T> {
  readonly value: T
}

export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
  [WritableComputedRefSymbol]: true
}

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export interface WritableComputedOptions<T, S = T> {
  get: ComputedGetter<T>
  set: ComputedSetter<S>
}

/**
 * 计算属性的内部实现类
 * @private 由 @vue/reactivity 导出供 Vue 核心使用，但不从主 vue 包导出
 */
export class ComputedRefImpl<T = any> implements Subscriber {
  /**
   * 计算属性的缓存值
   * @internal
   */
  _value: any = undefined
  /**
   * 依赖管理器，用于收集和触发依赖
   * @internal
   */
  readonly dep: Dep = new Dep(this)
  /**
   * 标识这是一个 ref 对象
   * @internal
   */
  readonly __v_isRef = true
  // TODO isolatedDeclarations ReactiveFlags.IS_REF
  /**
   * 标识是否为只读
   * @internal
   */
  readonly __v_isReadonly: boolean
  // TODO isolatedDeclarations ReactiveFlags.IS_READONLY
  // A computed is also a subscriber that tracks other deps
  /**
   * 依赖链表的头节点，用于跟踪此计算属性依赖的其他响应式数据
   * @internal
   */
  deps?: Link = undefined
  /**
   * 依赖链表的尾节点
   * @internal
   */
  depsTail?: Link = undefined
  /**
   * 效果标志位，用于控制计算属性的状态（脏值、通知等）
   * @internal
   */
  flags: EffectFlags = EffectFlags.DIRTY
  /**
   * 全局版本号，用于缓存失效判断
   * @internal
   */
  globalVersion: number = globalVersion - 1
  /**
   * 是否在服务端渲染环境中
   * @internal
   */
  isSSR: boolean
  /**
   * 批处理队列中的下一个订阅者指针
   * @internal
   */
  next?: Subscriber = undefined

  // 向后兼容，effect 属性指向自身
  effect: this = this
  // 仅开发模式：依赖收集时的调试回调
  onTrack?: (event: DebuggerEvent) => void
  // 仅开发模式：依赖触发时的调试回调
  onTrigger?: (event: DebuggerEvent) => void

  /**
   * 仅开发模式：用于警告递归计算
   * @internal
   */
  _warnRecursive?: boolean

  /**
   * 构造函数
   * @param fn 计算函数（getter）
   * @param setter 设置函数（可选，用于可写计算属性）
   * @param isSSR 是否在 SSR 环境中
   */
  constructor(
    public fn: ComputedGetter<T>,
    private readonly setter: ComputedSetter<T> | undefined,
    isSSR: boolean,
  ) {
    // 如果没有 setter，则为只读
    this[ReactiveFlags.IS_READONLY] = !setter
    this.isSSR = isSSR
  }

  /**
   * 通知计算属性需要更新
   * 实现 Subscriber 接口的核心方法
   * @internal
   */
  notify(): true | void {
    // 标记为脏值，需要重新计算
    this.flags |= EffectFlags.DIRTY
    if (
      !(this.flags & EffectFlags.NOTIFIED) &&
      // 避免无限自递归
      activeSub !== this
    ) {
      // 将此计算属性添加到批处理队列中
      batch(this, true)
      return true
    } else if (__DEV__) {
      // TODO warn
    }
  }

  /**
   * 获取计算属性的值
   * 实现响应式访问器属性
   */
  get value(): T {
    // 在开发模式下进行依赖收集并记录调试信息
    const link = __DEV__
      ? this.dep.track({
          target: this,
          type: TrackOpTypes.GET,
          key: 'value',
        })
      : this.dep.track()
    // 刷新计算属性（重新计算或使用缓存）
    refreshComputed(this)
    // 同步版本号，确保依赖关系正确
    if (link) {
      link.version = this.dep.version
    }
    return this._value
  }

  /**
   * 设置计算属性的值
   * 仅对可写计算属性有效
   */
  set value(newValue) {
    if (this.setter) {
      // 如果有 setter，使用用户定义的setter调用。
      this.setter(newValue)
    } else if (__DEV__) {
      // 开发模式下警告尝试写入只读计算属性
      warn('Write operation failed: computed value is readonly')
    }
  }
}

/**
 * 接收一个 getter 函数并返回一个只读的响应式 ref 对象，该对象的值来自 getter 函数的返回值。
 * 也可以接收一个包含 get 和 set 函数的对象来创建一个可写的 ref 对象。
 *
 * @example
 * ```js
 * // 创建只读计算属性 ref：
 * const count = ref(1)
 * const plusOne = computed(() => count.value + 1)
 *
 * console.log(plusOne.value) // 2
 * plusOne.value++ // error
 * ```
 *
 * ```js
 * // 创建可写计算属性 ref：
 * const count = ref(1)
 * const plusOne = computed({
 *   get: () => count.value + 1,
 *   set: (val) => {
 *     count.value = val - 1
 *   }
 * })
 *
 * plusOne.value = 1
 * console.log(count.value) // 0
 * ```
 *
 * @param getter - 产生下一个值的函数
 * @param debugOptions - 调试选项。参见 {@link https://vuejs.org/guide/extras/reactivity-in-depth.html#computed-debugging}
 * @see {@link https://vuejs.org/api/reactivity-core.html#computed}
 */
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions,
): ComputedRef<T>
export function computed<T, S = T>(
  options: WritableComputedOptions<T, S>,
  debugOptions?: DebuggerOptions,
): WritableComputedRef<T, S>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false,
) {
  // 声明 getter 和 setter 变量
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T> | undefined

  // 判断传入的参数类型并解构赋值
  if (isFunction(getterOrOptions)) {
    // 如果是函数，直接作为 getter 使用（只读计算属性）
    getter = getterOrOptions
  } else {
    // 如果是对象，提取 get 和 set 方法（可写计算属性）
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  // 创建 ComputedRefImpl 实例，这是计算属性的核心实现
  const cRef = new ComputedRefImpl(getter, setter, isSSR)

  // 在开发模式下设置调试钩子（非 SSR 环境）
  if (__DEV__ && debugOptions && !isSSR) {
    // 设置依赖收集时的调试回调
    cRef.onTrack = debugOptions.onTrack
    // 设置依赖触发时的调试回调
    cRef.onTrigger = debugOptions.onTrigger
  }

  // 返回计算属性实例（类型断言为 any 以满足函数重载的返回类型）
  return cRef as any
}
