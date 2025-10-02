import {
  type Target,
  isReadonly,
  isShallow,
  reactive,
  reactiveMap,
  readonly,
  readonlyMap,
  shallowReactiveMap,
  shallowReadonlyMap,
  toRaw,
} from './reactive'
import { arrayInstrumentations } from './arrayInstrumentations'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import { ITERATE_KEY, track, trigger } from './dep'
import {
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  isSymbol,
  makeMap,
} from '@vue/shared'
import { isRef } from './ref'
import { warn } from './warning'

const isNonTrackableKeys = /*@__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  /*@__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => Symbol[key as keyof SymbolConstructor])
    .filter(isSymbol),
)

function hasOwnProperty(this: object, key: unknown) {
  // #10455 hasOwnProperty may be called with non-string values
  if (!isSymbol(key)) key = String(key)
  const obj = toRaw(this)
  track(obj, TrackOpTypes.HAS, key)
  return obj.hasOwnProperty(key as string)
}

/**
 * Vue 3 响应式系统的基础代理处理器类
 * 实现了 ProxyHandler 接口，用于拦截对象的属性访问、设置等操作
 * 作为 MutableReactiveHandler 和 ReadonlyReactiveHandler 的基类
 */
class BaseReactiveHandler implements ProxyHandler<Target> {
  /**
   * 构造函数 - 初始化代理处理器的配置选项
   * @param _isReadonly 是否为只读模式，默认为 false
   * @param _isShallow 是否为浅层响应式模式，默认为 false
   */
  constructor(
    protected readonly _isReadonly = false,
    protected readonly _isShallow = false,
  ) {}

  /**
   * get 陷阱 - 拦截对象属性的读取操作
   * 这是响应式系统依赖收集的核心入口
   * @param target 被代理的原始目标对象
   * @param key 要访问的属性键
   * @param receiver 代理对象本身或继承自代理的对象
   * @returns 属性值或经过处理的响应式对象
   */
  get(target: Target, key: string | symbol, receiver: object): any {
    // 如果访问的是 SKIP 标志，直接返回对应值，用于跳过响应式处理
    if (key === ReactiveFlags.SKIP) return target[ReactiveFlags.SKIP]

    // 缓存配置选项，避免重复访问实例属性
    const isReadonly = this._isReadonly,
      isShallow = this._isShallow

    // 处理响应式系统的内部标志访问
    // 检查对象是否为响应式对象（非只读即为响应式）
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      // 检查对象是否为只读对象
      return isReadonly
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      // 检查对象是否为浅层响应式对象
      return isShallow
    } else if (key === ReactiveFlags.RAW) {
      // 获取原始对象的关键逻辑 - 需要进行安全性验证
      /*
       * 双重安全验证机制确保只有合法的代理对象才能访问原始对象
       *
       * 验证分支 1：检查 receiver 是否是 target 的正确代理对象
       * 从对应的响应式 Map 缓存中获取 target 的代理对象进行比较
       *
       * 验证分支 2：原型链验证，处理用户自定义代理的情况
       * 当用户创建了一个代理，且这个代理的目标是 Vue 的响应式代理时
       * 通过比较 target（原始对象）和 receiver（可能是用户代理）的原型
       * 如果原型相同，说明 receiver 是基于 target 创建的合法代理
       *
       * 安全性考虑：防止恶意代码通过伪造的 receiver 获取原始对象
       * 例如：
       * const obj = { secret: 'important data' }
       * const reactiveObj = reactive(obj)
       * const maliciousProxy = new Proxy({}, {
       *   get() { return reactiveObj[ReactiveFlags.RAW] } // 这会被阻止
       * })
       */
      if (
        receiver ===
          (isReadonly
            ? isShallow
              ? shallowReadonlyMap // 浅层只读映射
              : readonlyMap // 深层只读映射
            : isShallow
              ? shallowReactiveMap // 浅层响应式映射
              : reactiveMap
          ) // 深层响应式映射
            .get(target) ||
        // receiver 不是响应式代理，但具有相同的原型链
        // 这意味着 receiver 是响应式代理的用户代理
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
      ) {
        return target // 验证通过，返回原始对象
      }
      // 验证失败，提前返回 undefined，阻止访问原始对象
      return
    }

    // 缓存目标对象是否为数组，避免重复检查
    const targetIsArray = isArray(target)

    // 只有在非只读模式下才需要拦截可变操作
    if (!isReadonly) {
      let fn: Function | undefined
      // 拦截数组的变更方法（如 push、pop、splice 等）
      // arrayInstrumentations 包含了重写的数组方法，确保数组操作能正确触发响应式更新
      if (targetIsArray && (fn = arrayInstrumentations[key])) {
        return fn
      }
      // 拦截 hasOwnProperty 方法，确保该操作能被正确追踪
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }

    // 使用 Reflect.get 获取属性值，保持正确的 this 绑定
    const res = Reflect.get(
      target,
      key,
      // 如果目标是 ref 对象的代理，使用原始 ref 作为 receiver
      // 这样可以避免在 ref 的所有类方法中调用 toRaw
      isRef(target) ? target : receiver,
    )

    // 跳过对内置 Symbol 和特殊键的依赖追踪
    // 这些键通常不需要响应式处理，如 Symbol.iterator, __proto__ 等
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    // 在非只读模式下进行依赖收集
    // track 函数会将当前的 effect 与该属性建立依赖关系
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    // 浅层响应式模式下直接返回结果，不进行深层处理
    if (isShallow) {
      return res
    }

    // 处理 ref 对象的自动解包
    if (isRef(res)) {
      // ref 解包规则：数组 + 整数索引时跳过解包，其他情况返回 ref.value
      // 这是为了保持数组索引访问的一致性：arr[0] 应该返回 ref 而不是值
      return targetIsArray && isIntegerKey(key) ? res : res.value
    }

    // 对象的递归响应式处理
    if (isObject(res)) {
      // 将返回的对象也转换为代理对象（递归响应式）
      // 这里进行 isObject 检查是为了避免无效值警告
      // 需要延迟访问 readonly 和 reactive 以避免循环依赖
      return isReadonly ? readonly(res) : reactive(res)
    }

    // 返回最终结果（基本类型值）
    return res
  }
}

/**
 * 可变响应式代理处理器类
 * 继承自 BaseReactiveHandler，专门处理可变响应式对象的各种操作
 * 实现了 set、deleteProperty、has、ownKeys 等核心代理方法
 * 负责在属性变更时触发响应式更新和依赖收集
 */
class MutableReactiveHandler extends BaseReactiveHandler {
  /**
   * 构造函数 - 初始化可变响应式处理器
   * @param isShallow 是否为浅层响应式模式，默认为 false（深层响应式）
   */
  constructor(isShallow = false) {
    // 调用父类构造函数，设置为非只读模式
    super(false, isShallow)
  }

  /**
   * set 陷阱 - 拦截对象属性的赋值操作
   * 这是响应式系统触发更新的核心入口
   * @param target 被代理的原始目标对象
   * @param key 要设置的属性键
   * @param value 要设置的新值
   * @param receiver 代理对象本身或继承自代理的对象
   * @returns 操作是否成功
   */
  set(
    target: Record<string | symbol, unknown>,
    key: string | symbol,
    value: unknown,
    receiver: object,
  ): boolean {
    // 获取旧值，用于后续的变更检测和触发器调用
    let oldValue = target[key]

    // 深层响应式模式下的特殊处理逻辑
    if (!this._isShallow) {
      // 检查旧值是否为只读响应式对象
      const isOldValueReadonly = isReadonly(oldValue)

      // 如果新值不是浅层响应式且不是只读，则转换为原始值
      // 这样可以避免嵌套代理，确保响应式系统的一致性
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue) // 获取旧值的原始对象
        value = toRaw(value) // 获取新值的原始对象
      }

      // 处理 ref 对象的特殊赋值逻辑
      // 当目标不是数组，旧值是 ref，新值不是 ref 时，直接更新 ref.value
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        if (isOldValueReadonly) {
          // 如果旧值是只读 ref，在开发模式下发出警告并阻止操作
          if (__DEV__) {
            warn(
              `Set operation on key "${String(key)}" failed: target is readonly.`,
              target[key],
            )
          }
          return true // 返回 true 表示操作"成功"，但实际没有修改
        } else {
          // 直接更新 ref 的值，这会自动触发 ref 的响应式更新
          oldValue.value = value
          return true
        }
      }
    } else {
      // 浅层模式下，对象按原样设置，无论是否为响应式对象
      // 这是浅层响应式的核心特征：只对第一层属性进行响应式处理
    }

    // 检查属性是否已存在，用于区分 ADD 和 SET 操作类型
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length // 数组：检查索引是否在当前长度范围内
        : hasOwn(target, key) // 对象：检查是否为自有属性

    // 使用 Reflect.set 执行实际的属性设置操作
    const result = Reflect.set(
      target,
      key,
      value,
      // 如果目标是 ref 对象的代理，使用原始 target 作为 receiver
      // 否则使用传入的 receiver，确保正确的 this 绑定
      isRef(target) ? target : receiver,
    )

    // 响应式更新触发的关键逻辑
    // 只有当 target 是 receiver 的原始对象时才触发更新
    // 这避免了在原型链上的对象被修改时错误地触发当前对象的更新
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // 新增属性：触发 ADD 类型的更新
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        // 属性值发生变化：触发 SET 类型的更新
        // hasChanged 进行了优化的值比较，避免不必要的更新
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }

    return result // 返回 Reflect.set 的结果
  }

  /**
   * deleteProperty 陷阱 - 拦截对象属性的删除操作
   * 负责在属性删除时触发相应的响应式更新
   * @param target 被代理的原始目标对象
   * @param key 要删除的属性键
   * @returns 删除操作是否成功
   */
  deleteProperty(
    target: Record<string | symbol, unknown>,
    key: string | symbol,
  ): boolean {
    // 检查属性是否存在，用于判断是否需要触发删除更新
    const hadKey = hasOwn(target, key)
    // 保存旧值，用于触发器的参数传递
    const oldValue = target[key]
    // 执行实际的属性删除操作
    const result = Reflect.deleteProperty(target, key)

    // 只有当删除成功且属性确实存在时，才触发 DELETE 类型的更新
    if (result && hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }

    return result
  }

  /**
   * has 陷阱 - 拦截 in 操作符和 hasOwnProperty 等属性存在性检查
   * 负责在属性访问检查时进行依赖收集
   * @param target 被代理的原始目标对象
   * @param key 要检查的属性键
   * @returns 属性是否存在
   */
  has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
    // 执行实际的属性存在性检查
    const result = Reflect.has(target, key)

    // 对于非 Symbol 键或非内置 Symbol，进行依赖收集
    // 内置 Symbol（如 Symbol.iterator）通常不需要响应式追踪
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key)
    }

    return result
  }

  /**
   * ownKeys 陷阱 - 拦截 Object.keys、Object.getOwnPropertyNames、
   * Object.getOwnPropertySymbols、for...in 等遍历操作
   * 负责在对象遍历时进行依赖收集
   * @param target 被代理的原始目标对象
   * @returns 对象的所有自有属性键数组
   */
  ownKeys(target: Record<string | symbol, unknown>): (string | symbol)[] {
    // 进行遍历操作的依赖收集
    track(
      target,
      TrackOpTypes.ITERATE,
      // 数组使用 'length' 作为迭代键，对象使用特殊的 ITERATE_KEY
      // 这样可以在数组长度变化或对象属性增删时正确触发更新
      isArray(target) ? 'length' : ITERATE_KEY,
    )

    // 返回对象的所有自有属性键
    return Reflect.ownKeys(target)
  }
}

class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow = false) {
    super(true, isShallow)
  }

  set(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target,
      )
    }
    return true
  }

  deleteProperty(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target,
      )
    }
    return true
  }
}

export const mutableHandlers: ProxyHandler<object> =
  /*@__PURE__*/ new MutableReactiveHandler()

export const readonlyHandlers: ProxyHandler<object> =
  /*@__PURE__*/ new ReadonlyReactiveHandler()

export const shallowReactiveHandlers: MutableReactiveHandler =
  /*@__PURE__*/ new MutableReactiveHandler(true)

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers: ReadonlyReactiveHandler =
  /*@__PURE__*/ new ReadonlyReactiveHandler(true)
