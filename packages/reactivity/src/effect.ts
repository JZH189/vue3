import { extend, hasChanged } from '@vue/shared'
import type { ComputedRefImpl } from './computed'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import { type Link, globalVersion } from './dep'
import { activeEffectScope } from './effectScope'
import { warn } from './warning'

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
  effect: Subscriber
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  scheduler?: EffectScheduler
  allowRecurse?: boolean
  onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export let activeSub: Subscriber | undefined

/**
 * 此设计提升了开发体验
 * 调试时可以通过查看单个 flags 数值快速了解所有状态
 * 减少了代码复杂度，避免管理多个独立的布尔属性
 * 提供了清晰的状态管理模式
 * 这种设计体现了 Vue 3 在性能和内存使用方面的深度优化，特别是在响应式系统这样的核心功能中，每一点性能提升都会对整体应用产生显著影响。
 */
export enum EffectFlags {
  /**
   * ReactiveEffect only
   * 为什么用 1 << 0 而不是直接写 1
   * 最直接的原因：
   * 1、代码可读性。每个标志占用不同的位，且顺序是连续的
   * 2、减少思维负担 - 不需要记住或计算 2^n 的值，减少出错概率
   * 3、编程约定
   */
  ACTIVE = 1 << 0, // 1: 00000001   副作用是否活跃
  RUNNING = 1 << 1, // 2: 00000010   副作用是否正在运行
  TRACKING = 1 << 2, // 4: 00000100   是否正在收集依赖
  NOTIFIED = 1 << 3, // 8: 00001000   是否已被通知
  DIRTY = 1 << 4, // 16: 00010000  是否需要重新计算
  ALLOW_RECURSE = 1 << 5, // 32: 00100000 是否允许递归
  PAUSED = 1 << 6, // 64: 01000000 是否已暂停
  EVALUATED = 1 << 7, // 128: 10000000 是否已求值
  // 快速心算公式：2的n次方
  // 1 << 0 = 2^0 = 1
  // 1 << 1 = 2^1 = 2
  // 1 << 2 = 2^2 = 4
  // 1 << 3 = 2^3 = 8
  // 1 << 4 = 2^4 = 16
  // 1 << 5 = 2^5 = 32
  // 1 << 6 = 2^6 = 64
  // 1 << 7 = 2^7 = 128
}

/**
 * Subscriber is a type that tracks (or subscribes to) a list of deps.
 */
export interface Subscriber extends DebuggerOptions {
  /**
   * Head of the doubly linked list representing the deps
   * @internal
   */
  deps?: Link
  /**
   * Tail of the same list
   * @internal
   */
  depsTail?: Link
  /**
   * @internal
   */
  flags: EffectFlags
  /**
   * @internal
   */
  next?: Subscriber
  /**
   * returning `true` indicates it's a computed that needs to call notify
   * on its dep too
   * @internal
   */
  notify(): true | void
}

const pausedQueueEffects = new WeakSet<ReactiveEffect>()

/**
 * ReactiveEffect 类是 Vue 3 响应式系统的核心实现
 * 负责管理副作用函数的执行、依赖收集和更新触发
 *
 * 主要功能：
 * 1. 执行副作用函数并自动收集依赖
 * 2. 当依赖发生变化时，自动重新执行副作用函数
 * 3. 管理副作用的生命周期（激活、暂停、停止）
 * 4. 处理调度器和清理函数
 */
export class ReactiveEffect<T = any>
  implements Subscriber, ReactiveEffectOptions
{
  /**
   * 依赖链表的头节点
   * 用于跟踪当前副作用依赖的所有响应式数据
   * @internal
   */
  deps?: Link = undefined

  /**
   * 依赖链表的尾节点
   * 便于在链表末尾快速添加新的依赖
   * @internal
   */
  depsTail?: Link = undefined

  /**
   * 副作用的状态标志位
   * 使用位运算来高效管理多个布尔状态
   * 默认状态：ACTIVE（激活） | TRACKING（正在追踪依赖）
   * @internal
   */
  flags: EffectFlags = EffectFlags.ACTIVE | EffectFlags.TRACKING

  /**
   * 指向下一个订阅者的指针
   * 用于在批处理队列中形成链表结构
   * @internal
   */
  next?: Subscriber = undefined

  /**
   * 清理函数，在副作用重新执行或停止时调用
   * 用于清理上一次执行产生的副作用（如事件监听器、定时器等）
   * @internal
   */
  cleanup?: () => void = undefined

  /** 调度器函数，控制副作用的执行时机 */
  scheduler?: EffectScheduler = undefined

  /** 副作用停止时的回调函数 */
  onStop?: () => void

  /** 依赖追踪时的调试回调 */
  onTrack?: (event: DebuggerEvent) => void

  /** 依赖触发时的调试回调 */
  onTrigger?: (event: DebuggerEvent) => void

  /**
   * 构造函数：创建一个新的响应式副作用
   * @param fn 要执行的副作用函数
   */
  constructor(public fn: () => T) {
    // 如果存在活跃的副作用作用域，将当前副作用添加到该作用域中
    // 这样可以统一管理作用域内的所有副作用（如组件卸载时批量清理）
    if (activeEffectScope && activeEffectScope.active) {
      activeEffectScope.effects.push(this)
    }
  }

  /**
   * 暂停副作用的执行
   * 设置 PAUSED 标志位，暂停后的副作用不会立即执行，而是加入暂停队列
   */
  pause(): void {
    //按位或赋值运算符，表示副作用现在处于"暂停"状态
    this.flags |= EffectFlags.PAUSED
  }

  /**
   * 恢复副作用的执行
   * 清除 PAUSED 标志位，如果副作用在暂停队列中，则移除并立即触发执行
   */
  resume(): void {
    if (this.flags & EffectFlags.PAUSED) {
      // 清除暂停标志位
      this.flags &= ~EffectFlags.PAUSED
      // 如果副作用在暂停队列中，移除并触发执行
      if (pausedQueueEffects.has(this)) {
        pausedQueueEffects.delete(this)
        this.trigger()
      }
    }
  }

  /**
   * 通知副作用需要更新
   * 这是响应式系统触发更新的入口点
   * @internal
   */
  notify(): void {
    // 防止递归执行：如果副作用正在运行且不允许递归，则直接返回
    if (
      this.flags & EffectFlags.RUNNING &&
      !(this.flags & EffectFlags.ALLOW_RECURSE)
    ) {
      return
    }
    // 如果尚未被通知，则加入批处理队列
    // 避免同一个更新周期内重复通知同一个副作用
    if (!(this.flags & EffectFlags.NOTIFIED)) {
      batch(this)
    }
  }

  /**
   * 执行副作用函数
   * 这是响应式系统的核心方法，负责:
   * 1. 设置依赖收集环境
   * 2. 执行用户的副作用函数
   * 3. 收集新的依赖
   * 4. 清理无用的依赖
   * @returns 副作用函数的返回值
   */
  run(): T {
    // 如果副作用已被停止，直接执行函数但不进行依赖收集
    if (!(this.flags & EffectFlags.ACTIVE)) {
      // stopped during cleanup
      return this.fn()
    }

    // 设置运行标志位
    this.flags |= EffectFlags.RUNNING

    // 清理上一次执行的副作用
    cleanupEffect(this)

    // 准备依赖收集：将所有现有依赖标记为待验证状态
    prepareDeps(this)

    // 保存当前的全局状态
    const prevEffect = activeSub
    const prevShouldTrack = shouldTrack

    // 设置当前副作用为活跃状态，开启依赖收集
    activeSub = this
    console.log('activeSub被设置了1', activeSub)
    shouldTrack = true

    try {
      // 执行用户的副作用函数，期间会自动收集依赖
      return this.fn()
    } finally {
      // 开发环境下检查状态一致性
      if (__DEV__ && activeSub !== this) {
        warn(
          'Active effect was not restored correctly - ' +
            'this is likely a Vue internal bug.',
        )
      }

      // 清理未使用的依赖
      cleanupDeps(this)

      // 恢复之前的全局状态
      activeSub = prevEffect
      console.log('activeSub被设置了2', activeSub)
      shouldTrack = prevShouldTrack

      // 清除运行标志位
      this.flags &= ~EffectFlags.RUNNING
    }
  }

  /**
   * 停止副作用的执行
   * 清理所有依赖关系，执行清理函数，并调用停止回调
   */
  stop(): void {
    if (this.flags & EffectFlags.ACTIVE) {
      // 遍历所有依赖，从对应的依赖中移除当前副作用
      for (let link = this.deps; link; link = link.nextDep) {
        removeSub(link)
      }

      // 清空依赖链表
      this.deps = this.depsTail = undefined

      // 执行清理函数
      cleanupEffect(this)

      // 调用停止回调
      this.onStop && this.onStop()

      // 清除激活标志位，标记副作用已停止
      this.flags &= ~EffectFlags.ACTIVE
    }
  }

  /**
   * 触发副作用的执行
   * 根据副作用的状态决定执行策略：
   * 1. 如果已暂停，加入暂停队列
   * 2. 如果有调度器，使用调度器执行
   * 3. 否则检查是否需要执行并直接运行
   */
  trigger(): void {
    if (this.flags & EffectFlags.PAUSED) {
      // 如果副作用已暂停，加入暂停队列等待恢复</T>
      pausedQueueEffects.add(this)
    } else if (this.scheduler) {
      // 如果有自定义调度器，使用调度器控制执行时机
      this.scheduler()
    } else {
      // 默认情况：检查是否脏数据，如果是则立即执行
      this.runIfDirty()
    }
  }

  /**
   * 仅在需要时运行副作用
   * 检查依赖是否发生变化，只有在"脏"状态时才执行
   * @internal
   */
  runIfDirty(): void {
    if (isDirty(this)) {
      this.run()
    }
  }

  /**
   * 获取副作用是否处于"脏"状态
   * "脏"表示依赖发生了变化，需要重新执行副作用函数
   */
  get dirty(): boolean {
    return isDirty(this)
  }
}

/**
 * For debugging
 */
// function printDeps(sub: Subscriber) {
//   let d = sub.deps
//   let ds = []
//   while (d) {
//     ds.push(d)
//     d = d.nextDep
//   }
//   return ds.map(d => ({
//     id: d.id,
//     prev: d.prevDep?.id,
//     next: d.nextDep?.id,
//   }))
// }

let batchDepth = 0
let batchedSub: Subscriber | undefined
let batchedComputed: Subscriber | undefined

/**
 * 将订阅者添加到批处理队列中
 * 这是响应式系统批处理机制的入口函数，用于收集需要延迟执行的副作用和计算属性
 *
 * @param sub 要添加到批处理队列的订阅者（副作用或计算属性）
 * @param isComputed 是否为计算属性，默认为 false
 */
export function batch(sub: Subscriber, isComputed = false): void {
  // 为订阅者添加 NOTIFIED 标志，表示该订阅者已被通知但尚未执行
  // 这个标志用于防止同一个订阅者在同一批次中被重复添加
  sub.flags |= EffectFlags.NOTIFIED

  // 如果是计算属性，添加到计算属性专用的批处理队列
  if (isComputed) {
    // 使用链表结构存储，新的计算属性插入到队列头部
    sub.next = batchedComputed
    batchedComputed = sub
    return
  }

  // 如果是普通副作用，添加到副作用批处理队列
  // 同样使用链表结构，新的副作用插入到队列头部
  /*
    假设有 effect1, effect2, effect3 需要执行
    第一次调用 batch(effect1)
    effect1.next = undefined
    batchedSub = effect1

    第二次调用 batch(effect2)  
    effect2.next = effect1  // 指向之前的头节点
    batchedSub = effect2    // 成为新的头节点

    第三次调用 batch(effect3)
    effect3.next = effect2  // 指向之前的头节点
    batchedSub = effect3    // 成为新的头节点

    最终链表结构：batchedSub|batchedComputed -> effect3 -> effect2 -> effect1 
  */
  sub.next = batchedSub
  batchedSub = sub
}

/**
 * @internal
 */
export function startBatch(): void {
  batchDepth++
}

/**
 * Run batched effects when all batches have ended
 * @internal
 */
/**
 * 结束批处理操作，清理批处理队列并执行所有待处理的副作用
 * 这是响应式系统批处理机制的核心函数，确保副作用的正确执行顺序
 */
export function endBatch(): void {
  // 递减批处理深度计数器，如果还有嵌套的批处理未完成则直接返回
  if (--batchDepth > 0) {
    return
  }

  // 首先处理批处理的计算属性队列
  if (batchedComputed) {
    let e: Subscriber | undefined = batchedComputed
    // 清空全局计算属性队列，防止在处理过程中新的计算属性被添加到当前批次
    batchedComputed = undefined
    // 遍历计算属性链表，清理每个计算属性的状态
    while (e) {
      const next: Subscriber | undefined = e.next
      // 断开链表连接，防止内存泄漏
      e.next = undefined
      // 清除 NOTIFIED 标志，表示该计算属性已被处理
      e.flags &= ~EffectFlags.NOTIFIED
      e = next
    }
  }

  // 用于收集执行过程中的错误
  let error: unknown
  // 处理批处理的副作用队列，可能需要多轮处理（因为副作用执行可能产生新的副作用）
  while (batchedSub) {
    let e: Subscriber | undefined = batchedSub
    // 清空全局副作用队列，为当前批次的处理做准备
    batchedSub = undefined
    // 遍历副作用链表
    while (e) {
      const next: Subscriber | undefined = e.next
      // 断开链表连接，防止内存泄漏
      e.next = undefined
      // 清除 NOTIFIED 标志，表示该副作用已被处理
      e.flags &= ~EffectFlags.NOTIFIED
      // 只有当副作用处于激活状态时才执行
      if (e.flags & EffectFlags.ACTIVE) {
        try {
          // ACTIVE 标志仅用于副作用（ReactiveEffect），计算属性不会有此标志
          // 执行副作用的触发器，这可能会导致新的依赖收集和触发
          ;(e as ReactiveEffect).trigger()
        } catch (err) {
          // 收集第一个错误，但继续处理剩余的副作用
          if (!error) error = err
        }
      }
      e = next
    }
  }

  // 如果在执行过程中有错误发生，在所有副作用处理完成后抛出
  if (error) throw error
}

function prepareDeps(sub: Subscriber) {
  // Prepare deps for tracking, starting from the head
  for (let link = sub.deps; link; link = link.nextDep) {
    // set all previous deps' (if any) version to -1 so that we can track
    // which ones are unused after the run
    link.version = -1
    // store previous active sub if link was being used in another context
    link.prevActiveLink = link.dep.activeLink
    link.dep.activeLink = link
  }
}

function cleanupDeps(sub: Subscriber) {
  // Cleanup unsued deps
  let head
  let tail = sub.depsTail
  let link = tail
  while (link) {
    const prev = link.prevDep
    if (link.version === -1) {
      if (link === tail) tail = prev
      // unused - remove it from the dep's subscribing effect list
      removeSub(link)
      // also remove it from this effect's dep list
      removeDep(link)
    } else {
      // The new head is the last node seen which wasn't removed
      // from the doubly-linked list
      head = link
    }

    // restore previous active link if any
    link.dep.activeLink = link.prevActiveLink
    link.prevActiveLink = undefined
    link = prev
  }
  // set the new head & tail
  sub.deps = head
  sub.depsTail = tail
}

function isDirty(sub: Subscriber): boolean {
  for (let link = sub.deps; link; link = link.nextDep) {
    if (
      link.dep.version !== link.version ||
      (link.dep.computed &&
        (refreshComputed(link.dep.computed) ||
          link.dep.version !== link.version))
    ) {
      return true
    }
  }
  // @ts-expect-error only for backwards compatibility where libs manually set
  // this flag - e.g. Pinia's testing module
  if (sub._dirty) {
    return true
  }
  return false
}

/**
 * Returning false indicates the refresh failed
 * @internal
 */
export function refreshComputed(computed: ComputedRefImpl): undefined {
  if (
    computed.flags & EffectFlags.TRACKING &&
    !(computed.flags & EffectFlags.DIRTY)
  ) {
    return
  }
  computed.flags &= ~EffectFlags.DIRTY

  // Global version fast path when no reactive changes has happened since
  // last refresh.
  if (computed.globalVersion === globalVersion) {
    return
  }
  computed.globalVersion = globalVersion

  // In SSR there will be no render effect, so the computed has no subscriber
  // and therefore tracks no deps, thus we cannot rely on the dirty check.
  // Instead, computed always re-evaluate and relies on the globalVersion
  // fast path above for caching.
  // #12337 if computed has no deps (does not rely on any reactive data) and evaluated,
  // there is no need to re-evaluate.
  if (
    !computed.isSSR &&
    computed.flags & EffectFlags.EVALUATED &&
    ((!computed.deps && !(computed as any)._dirty) || !isDirty(computed))
  ) {
    return
  }
  computed.flags |= EffectFlags.RUNNING

  const dep = computed.dep
  const prevSub = activeSub
  const prevShouldTrack = shouldTrack
  activeSub = computed
  shouldTrack = true

  try {
    prepareDeps(computed)
    const value = computed.fn(computed._value)
    if (dep.version === 0 || hasChanged(value, computed._value)) {
      computed.flags |= EffectFlags.EVALUATED
      computed._value = value
      dep.version++
    }
  } catch (err) {
    dep.version++
    throw err
  } finally {
    activeSub = prevSub
    shouldTrack = prevShouldTrack
    cleanupDeps(computed)
    computed.flags &= ~EffectFlags.RUNNING
  }
}

function removeSub(link: Link, soft = false) {
  const { dep, prevSub, nextSub } = link
  if (prevSub) {
    prevSub.nextSub = nextSub
    link.prevSub = undefined
  }
  if (nextSub) {
    nextSub.prevSub = prevSub
    link.nextSub = undefined
  }
  if (__DEV__ && dep.subsHead === link) {
    // was previous head, point new head to next
    dep.subsHead = nextSub
  }

  if (dep.subs === link) {
    // was previous tail, point new tail to prev
    dep.subs = prevSub

    if (!prevSub && dep.computed) {
      // if computed, unsubscribe it from all its deps so this computed and its
      // value can be GCed
      dep.computed.flags &= ~EffectFlags.TRACKING
      for (let l = dep.computed.deps; l; l = l.nextDep) {
        // here we are only "soft" unsubscribing because the computed still keeps
        // referencing the deps and the dep should not decrease its sub count
        removeSub(l, true)
      }
    }
  }

  if (!soft && !--dep.sc && dep.map) {
    // #11979
    // property dep no longer has effect subscribers, delete it
    // this mostly is for the case where an object is kept in memory but only a
    // subset of its properties is tracked at one time
    dep.map.delete(dep.key)
  }
}

function removeDep(link: Link) {
  const { prevDep, nextDep } = link
  if (prevDep) {
    prevDep.nextDep = nextDep
    link.prevDep = undefined
  }
  if (nextDep) {
    nextDep.prevDep = prevDep
    link.nextDep = undefined
  }
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions,
): ReactiveEffectRunner<T> {
  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const e = new ReactiveEffect(fn)
  if (options) {
    extend(e, options)
  }
  try {
    e.run()
  } catch (err) {
    e.stop()
    throw err
  }
  const runner = e.run.bind(e) as ReactiveEffectRunner
  runner.effect = e
  return runner
}

/**
 * Stops the effect associated with the given runner.
 *
 * @param runner - Association with the effect to stop tracking.
 */
export function stop(runner: ReactiveEffectRunner): void {
  runner.effect.stop()
}

/**
 * @internal
 */
export let shouldTrack = true
const trackStack: boolean[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

/**
 * Re-enables effect tracking (if it was paused).
 */
export function enableTracking(): void {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

/**
 * Resets the previous global effect tracking state.
 */
export function resetTracking(): void {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

/**
 * Registers a cleanup function for the current active effect.
 * The cleanup function is called right before the next effect run, or when the
 * effect is stopped.
 *
 * Throws a warning if there is no current active effect. The warning can be
 * suppressed by passing `true` to the second argument.
 *
 * @param fn - the cleanup function to be registered
 * @param failSilently - if `true`, will not throw warning when called without
 * an active effect.
 */
export function onEffectCleanup(fn: () => void, failSilently = false): void {
  if (activeSub instanceof ReactiveEffect) {
    activeSub.cleanup = fn
  } else if (__DEV__ && !failSilently) {
    warn(
      `onEffectCleanup() was called when there was no active effect` +
        ` to associate with.`,
    )
  }
}

/**
 * 清理副作用函数，用于在副作用失效或重新执行前进行清理工作
 *
 * @param e - 需要清理的响应式副作用对象
 */
function cleanupEffect(e: ReactiveEffect) {
  // 获取副作用的清理函数
  const { cleanup } = e
  // 立即清空清理函数引用，防止重复清理
  e.cleanup = undefined

  if (cleanup) {
    // 在没有活跃副作用的环境中运行清理函数
    // 这样做是为了避免清理过程中意外触发新的依赖收集
    const prevSub = activeSub
    activeSub = undefined
    try {
      // 执行用户定义的清理逻辑
      cleanup()
    } finally {
      // 无论清理是否成功，都要恢复之前的活跃订阅者
      // 确保不会影响外层的副作用执行环境
      activeSub = prevSub
    }
  }
}
