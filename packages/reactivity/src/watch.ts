import {
  EMPTY_OBJ,
  NOOP,
  hasChanged,
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isSet,
  remove,
} from '@vue/shared'
import { warn } from './warning'
import type { ComputedRef } from './computed'
import { ReactiveFlags } from './constants'
import {
  type DebuggerOptions,
  EffectFlags,
  type EffectScheduler,
  ReactiveEffect,
  pauseTracking,
  resetTracking,
} from './effect'
import { isReactive, isShallow } from './reactive'
import { type Ref, isRef } from './ref'
import { getCurrentScope } from './effectScope'

// These errors were transferred from `packages/runtime-core/src/errorHandling.ts`
// to @vue/reactivity to allow co-location with the moved base watch logic, hence
// it is essential to keep these values unchanged.
export enum WatchErrorCodes {
  WATCH_GETTER = 2,
  WATCH_CALLBACK,
  WATCH_CLEANUP,
}

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = Ref<T, any> | ComputedRef<T> | (() => T)

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => any

export type OnCleanup = (cleanupFn: () => void) => void

export interface WatchOptions<Immediate = boolean> extends DebuggerOptions {
  immediate?: Immediate
  deep?: boolean | number
  once?: boolean
  scheduler?: WatchScheduler
  onWarn?: (msg: string, ...args: any[]) => void
  /**
   * @internal
   */
  augmentJob?: (job: (...args: any[]) => void) => void
  /**
   * @internal
   */
  call?: (
    fn: Function | Function[],
    type: WatchErrorCodes,
    args?: unknown[],
  ) => void
}

export type WatchStopHandle = () => void

export interface WatchHandle extends WatchStopHandle {
  pause: () => void
  resume: () => void
  stop: () => void
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

export type WatchScheduler = (job: () => void, isFirstRun: boolean) => void

const cleanupMap: WeakMap<ReactiveEffect, (() => void)[]> = new WeakMap()
let activeWatcher: ReactiveEffect | undefined = undefined

/**
 * Returns the current active effect if there is one.
 */
export function getCurrentWatcher(): ReactiveEffect<any> | undefined {
  return activeWatcher
}

/**
 * Registers a cleanup callback on the current active effect. This
 * registered cleanup callback will be invoked right before the
 * associated effect re-runs.
 *
 * @param cleanupFn - The callback function to attach to the effect's cleanup.
 * @param failSilently - if `true`, will not throw warning when called without
 * an active effect.
 * @param owner - The effect that this cleanup function should be attached to.
 * By default, the current active effect.
 */
export function onWatcherCleanup(
  cleanupFn: () => void,
  failSilently = false,
  owner: ReactiveEffect | undefined = activeWatcher,
): void {
  if (owner) {
    let cleanups = cleanupMap.get(owner)
    if (!cleanups) cleanupMap.set(owner, (cleanups = []))
    cleanups.push(cleanupFn)
  } else if (__DEV__ && !failSilently) {
    warn(
      `onWatcherCleanup() was called when there was no active watcher` +
        ` to associate with.`,
    )
  }
}

export function watch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb?: WatchCallback | null,
  options: WatchOptions = EMPTY_OBJ,
): WatchHandle {
  const { immediate, deep, once, scheduler, augmentJob, call } = options

  // 警告无效的监听源的函数
  const warnInvalidSource = (s: unknown) => {
    ;(options.onWarn || warn)(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, ` +
        `a reactive object, or an array of these types.`,
    )
  }

  // 处理响应式对象的 getter 函数
  const reactiveGetter = (source: object) => {
    // 如果设置了 deep，则直接返回源对象，在包装后的 getter 中进行遍历
    if (deep) return source
    // 对于 `deep: false | 0` 或浅层响应式对象，只遍历根级属性
    if (isShallow(source) || deep === false || deep === 0)
      return traverse(source, 1)
    // 对于响应式对象上的 `deep: undefined`，深度遍历所有属性
    return traverse(source)
  }

  let effect: ReactiveEffect
  let getter: () => any
  let cleanup: (() => void) | undefined
  let boundCleanup: typeof onWatcherCleanup
  let forceTrigger = false
  let isMultiSource = false

  // 根据不同的 source 类型设置相应的 getter 和配置
  if (isRef(source)) {
    // 如果 source 是一个 ref，则 getter 返回其 value
    getter = () => source.value
    // 如果是浅层 ref，则强制触发更新
    forceTrigger = isShallow(source)
  } else if (isReactive(source)) {
    // 如果 source 是响应式对象，则使用 reactiveGetter
    getter = () => reactiveGetter(source)
    // 响应式对象需要强制触发更新
    forceTrigger = true
  } else if (isArray(source)) {
    // 如果 source 是数组，则是多个监听源
    isMultiSource = true
    // 检查是否有响应式或浅层对象来决定是否强制触发
    forceTrigger = source.some(s => isReactive(s) || isShallow(s))
    getter = () =>
      source.map(s => {
        if (isRef(s)) {
          // ref 类型返回其 value
          return s.value
        } else if (isReactive(s)) {
          // 响应式对象使用 reactiveGetter
          return reactiveGetter(s)
        } else if (isFunction(s)) {
          // 函数类型则执行函数
          return call ? call(s, WatchErrorCodes.WATCH_GETTER) : s()
        } else {
          // 其他类型发出警告
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    // 如果 source 是函数
    if (cb) {
      // 有回调函数的情况：getter 就是这个函数
      getter = call
        ? () => call(source, WatchErrorCodes.WATCH_GETTER)
        : (source as () => any)
    } else {
      // 没有回调函数的情况：简单 effect
      getter = () => {
        // 如果存在清理函数，则先执行清理
        if (cleanup) {
          pauseTracking()
          try {
            cleanup()
          } finally {
            resetTracking()
          }
        }
        // 设置当前活跃的 watcher
        const currentEffect = activeWatcher
        activeWatcher = effect
        try {
          // 执行 source 函数并传入清理函数
          return call
            ? call(source, WatchErrorCodes.WATCH_CALLBACK, [boundCleanup])
            : source(boundCleanup)
        } finally {
          // 恢复之前的活跃 watcher
          activeWatcher = currentEffect
        }
      }
    }
  } else {
    // 无效的 source 类型
    getter = NOOP
    __DEV__ && warnInvalidSource(source)
  }

  // 如果有回调函数且设置了 deep，则需要深度遍历
  if (cb && deep) {
    const baseGetter = getter
    const depth = deep === true ? Infinity : deep
    getter = () => traverse(baseGetter(), depth)
  }

  // 获取当前作用域
  const scope = getCurrentScope()
  // 创建停止监听的句柄函数
  const watchHandle: WatchHandle = () => {
    effect.stop()
    if (scope && scope.active) {
      remove(scope.effects, effect)
    }
  }

  // 如果设置了 once 且有回调函数，则包装回调函数以便只执行一次
  if (once && cb) {
    const _cb = cb
    cb = (...args) => {
      _cb(...args)
      watchHandle()
    }
  }

  // 初始化旧值
  let oldValue: any = isMultiSource
    ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
    : INITIAL_WATCHER_VALUE

  // 定义实际执行的任务函数
  const job = (immediateFirstRun?: boolean) => {
    // 如果 effect 不活跃或者没有变化且不是立即执行，则直接返回
    if (
      !(effect.flags & EffectFlags.ACTIVE) ||
      (!effect.dirty && !immediateFirstRun)
    ) {
      return
    }
    if (cb) {
      // 有回调函数的情况：watch(source, cb)
      const newValue = effect.run()
      // 检查值是否发生变化
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) => hasChanged(v, oldValue[i]))
          : hasChanged(newValue, oldValue))
      ) {
        // 在重新运行回调之前执行清理
        if (cleanup) {
          cleanup()
        }
        // 设置当前活跃的 watcher
        const currentWatcher = activeWatcher
        activeWatcher = effect
        try {
          // 准备回调函数参数
          const args = [
            newValue,
            // 当第一次改变时，旧值传入 undefined
            oldValue === INITIAL_WATCHER_VALUE
              ? undefined
              : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE
                ? []
                : oldValue,
            boundCleanup,
          ]
          // 更新旧值
          oldValue = newValue
          // 执行回调函数
          call
            ? call(cb!, WatchErrorCodes.WATCH_CALLBACK, args)
            : // @ts-expect-error
              cb!(...args)
        } finally {
          // 恢复之前的活跃 watcher
          activeWatcher = currentWatcher
        }
      }
    } else {
      // 没有回调函数的情况：watchEffect，直接运行 effect
      effect.run()
    }
  }

  // 如果提供了 augmentJob 选项，则增强 job 函数
  if (augmentJob) {
    augmentJob(job)
  }

  // 创建响应式 effect
  effect = new ReactiveEffect(getter)

  // 设置调度器
  effect.scheduler = scheduler
    ? () => scheduler(job, false)
    : (job as EffectScheduler)

  // 绑定清理函数到特定的 effect
  boundCleanup = fn => onWatcherCleanup(fn, false, effect)

  // 设置 effect 的停止回调
  cleanup = effect.onStop = () => {
    const cleanups = cleanupMap.get(effect)
    if (cleanups) {
      if (call) {
        call(cleanups, WatchErrorCodes.WATCH_CLEANUP)
      } else {
        for (const cleanup of cleanups) cleanup()
      }
      cleanupMap.delete(effect)
    }
  }

  // 开发环境下设置跟踪和触发的回调
  if (__DEV__) {
    effect.onTrack = options.onTrack
    effect.onTrigger = options.onTrigger
  }

  // 初始运行
  if (cb) {
    // 有回调函数的情况
    if (immediate) {
      // 如果设置了 immediate，则立即执行任务
      job(true)
    } else {
      // 否则运行 effect 获取初始值
      oldValue = effect.run()
    }
  } else if (scheduler) {
    // 没有回调函数但有调度器的情况
    scheduler(job.bind(null, true), true)
  } else {
    // 默认情况直接运行 effect
    effect.run()
  }

  // 为 watchHandle 添加暂停、恢复和停止方法
  watchHandle.pause = effect.pause.bind(effect)
  watchHandle.resume = effect.resume.bind(effect)
  watchHandle.stop = watchHandle

  return watchHandle
}

export function traverse(
  value: unknown,
  depth: number = Infinity,
  seen?: Map<unknown, number>,
): unknown {
  if (depth <= 0 || !isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value
  }

  seen = seen || new Map()
  if ((seen.get(value) || 0) >= depth) {
    return value
  }
  seen.set(value, depth)
  depth--
  if (isRef(value)) {
    traverse(value.value, depth, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, depth, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, seen)
    }
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        traverse(value[key as any], depth, seen)
      }
    }
  }
  return value
}
