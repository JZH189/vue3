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
 * 订阅者接口：用于跟踪（或订阅）一系列依赖项的类型定义
 *
 * 这是 Vue 3 响应式系统中的核心抽象接口，所有能够订阅响应式数据变化的对象都需要实现此接口
 * 主要实现者包括：
 * - ReactiveEffect：副作用函数，如 watchEffect、render 函数等
 * - ComputedRefImpl：计算属性实现
 *
 * 设计特点：
 * 1. 双向链表结构：使用 deps 和 depsTail 维护依赖项的双向链表
 * 2. 批处理支持：通过 next 指针支持批处理队列的链式管理
 * 3. 状态管理：使用 flags 位标志高效管理订阅者的各种状态
 * 4. 类型区分：通过 notify() 返回值区分普通副作用和计算属性
 * 5. 调试支持：继承自 DebuggerOptions，提供开发时的调试钩子
 *
 * 核心职责：
 * - 维护与响应式数据的依赖关系
 * - 在数据变化时接收通知并执行相应的更新逻辑
 * - 支持依赖的动态添加和清理
 * - 参与响应式系统的批处理优化机制
 */
export interface Subscriber extends DebuggerOptions {
  /**
   * 依赖项双向链表的头节点指针
   *
   * 功能说明：
   * - 指向此订阅者依赖的第一个响应式数据的链接节点
   * - 用于遍历此订阅者的所有依赖项
   * - 在依赖收集和清理过程中起到关键作用
   *
   * 数据结构：
   * - 每个 Link 节点包含对 Dep 的引用以及前后节点的指针
   * - 形成双向链表，支持高效的插入、删除和遍历操作
   *
   * 生命周期：
   * - 在 prepareDeps 阶段准备依赖收集
   * - 在执行过程中动态更新依赖关系
   * - 在 cleanupDeps 阶段清理不再使用的依赖
   *
   * @internal 内部使用，不对外暴露
   */
  deps?: Link

  /**
   * 依赖项双向链表的尾节点指针
   *
   * 功能说明：
   * - 指向此订阅者依赖的最后一个响应式数据的链接节点
   * - 便于在链表尾部快速插入新的依赖项
   * - 在反向遍历依赖项时提供起始点
   *
   * 设计意义：
   * - 提高依赖项插入的性能（O(1) 时间复杂度）
   * - 支持从尾部开始的依赖清理策略
   * - 维护链表结构的完整性
   *
   * 与 deps 的关系：
   * - deps 指向链表头，depsTail 指向链表尾
   * - 当只有一个依赖时，deps === depsTail
   * - 当没有依赖时，两者都为 undefined
   *
   * @internal 内部使用，不对外暴露
   */
  depsTail?: Link

  /**
   * 订阅者状态标志位集合
   *
   * 使用位标志 (EffectFlags) 高效管理订阅者的多种状态：
   *
   * 常用标志位：
   * - EffectFlags.ACTIVE: 订阅者是否处于活跃状态
   * - EffectFlags.RUNNING: 订阅者是否正在执行中
   * - EffectFlags.TRACKING: 是否正在进行依赖收集
   * - EffectFlags.DIRTY: 订阅者是否需要重新执行（主要用于计算属性）
   * - EffectFlags.NOTIFIED: 在当前批次中是否已被通知过
   *
   * 设计优势：
   * - 内存效率：单个数字存储多个布尔状态
   * - 操作高效：位运算比多个属性访问更快
   * - 状态一致：避免状态分散导致的不一致问题
   *
   * 使用方式：
   * - 设置标志：flags |= EffectFlags.RUNNING
   * - 清除标志：flags &= ~EffectFlags.RUNNING
   * - 检查标志：flags & EffectFlags.RUNNING
   *
   * @internal 内部使用，不对外暴露
   */
  flags: EffectFlags

  /**
   * 批处理队列中指向下一个订阅者的指针
   *
   * 功能说明：
   * - 用于构建批处理执行的订阅者链表
   * - 当多个订阅者需要在同一批次中执行时，通过此指针连接
   * - 支持响应式系统的批处理优化机制
   *
   * 工作原理：
   * - 当订阅者被添加到批处理队列时，设置 next 指针
   * - 批处理执行时，沿着 next 指针遍历所有待执行的订阅者
   * - 执行完成后，清空 next 指针防止内存泄漏
   *
   * 批处理优势：
   * - 避免同步执行多个更新导致的性能问题
   * - 确保更新的顺序和一致性
   * - 减少不必要的重复计算
   *
   * 内存管理：
   * - 执行完成后必须设置为 undefined
   * - 防止形成循环引用导致内存泄漏
   *
   * @internal 内部使用，不对外暴露
   */
  next?: Subscriber

  /**
   * 通知订阅者执行更新的核心方法
   *
   * 返回值语义：
   * - 返回 true：表示这是一个计算属性 (ComputedRefImpl)
   *   需要继续通知其自身的依赖项（computed.dep.notify()）
   * - 返回 void：表示这是一个普通副作用 (ReactiveEffect)
   *   只需要将自身加入批处理队列即可
   *
   * 执行流程：
   * 1. 检查是否需要执行（避免重复通知）
   * 2. 更新订阅者状态（如设置 DIRTY 标志）
   * 3. 将订阅者添加到批处理队列
   * 4. 返回适当的值指示后续处理
   *
   * 设计意义：
   * - 统一的通知接口，支持不同类型的订阅者
   * - 通过返回值区分处理策略，避免类型检查的开销
   * - 支持计算属性的级联更新机制
   *
   * 实现要点：
   * - 必须是幂等操作（多次调用效果相同）
   * - 需要正确处理并发和重入情况
   * - 要考虑调试钩子的触发时机
   *
   * @internal 内部使用，不对外暴露
   * @returns true 表示是计算属性，需要继续通知其依赖项；void 表示普通副作用
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
   * 该属性值初始化是在 dep.ts 文件中的 track 方法中activeSub.deps = activeSub.depsTail = link
   * @internal
   */
  deps?: Link = undefined

  /**
   * 依赖链表的尾节点
   * 便于在链表末尾快速添加新的依赖
   * * 该属性值初始化是在 dep.ts 文件中的 track 方法中activeSub.deps = activeSub.depsTail = link
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

/**
 * 为订阅者准备依赖收集，这是响应式系统执行前的关键预处理步骤
 *
 * 主要功能：
 * 1. 标记所有现有依赖为待验证状态（version = -1）
 * 2. 保存并设置依赖的活跃链接状态
 * 3. 为后续的依赖清理机制做准备
 *
 * @param sub 需要准备依赖的订阅者（ReactiveEffect 或 ComputedRefImpl）
 */
function prepareDeps(sub: Subscriber) {
  // 从订阅者的依赖链表头部开始，遍历所有依赖项
  // sub.deps 是依赖链表的头节点，link.nextDep 指向下一个依赖
  for (let link = sub.deps; link; link = link.nextDep) {
    // 将所有现有依赖的版本标记为 -1（待验证状态）
    // 这样可以在执行后追踪哪些依赖在本次运行中未被使用
    // 未使用的依赖（version 仍为 -1）将在 cleanupDeps 中被清理
    link.version = -1

    // 保存当前依赖的活跃链接状态，防止在嵌套执行时丢失上下文
    // 这在嵌套 effect 或 computed 执行时非常重要
    link.prevActiveLink = link.dep.activeLink

    // 将当前链接设置为该依赖的活跃链接
    // 这样在依赖收集时，Dep.track() 就能找到正确的 Link 实例
    link.dep.activeLink = link
  }
}

/**
 * 清理订阅者中未使用的依赖项，这是响应式系统内存管理的关键机制
 *
 * 工作原理：
 * 1. 从依赖链表尾部开始反向遍历（因为添加依赖时是从头部插入）
 * 2. 检查每个依赖的版本号，-1 表示在本次执行中未被使用
 * 3. 移除未使用的依赖，保留使用过的依赖
 * 4. 重新构建依赖链表，更新头尾指针
 * 5. 恢复依赖的活跃链接状态
 *
 * 这确保了：
 * - 内存效率：移除不再需要的依赖关系
 * - 性能优化：减少无效的响应式更新
 * - 状态一致性：正确维护依赖图的完整性
 *
 * @param sub 需要清理依赖的订阅者（ReactiveEffect 或 ComputedRefImpl）
 */
function cleanupDeps(sub: Subscriber) {
  // 清理未使用的依赖项
  let head
  // 从依赖链表的尾部开始处理
  let tail = sub.depsTail
  let link = tail

  // 反向遍历依赖链表（从尾部到头部）
  // 反向遍历的原因：新的依赖通常从头部添加，尾部的依赖可能更容易被废弃
  while (link) {
    const prev = link.prevDep

    // 检查依赖是否在本次执行中被使用
    // version === -1 表示该依赖在 prepareDeps 后未被访问，即未使用
    if (link.version === -1) {
      // 如果当前链接是尾节点，更新尾指针
      if (link === tail) tail = prev

      // 从依赖的订阅者列表中移除此订阅者
      // 这会断开 Dep -> Subscriber 的反向引用
      removeSub(link)

      // 从当前订阅者的依赖列表中移除此依赖
      // 这会断开 Subscriber -> Dep 的正向引用
      removeDep(link)
    } else {
      // 该依赖被使用过（version 已在 track 时更新）
      // 将其设为新的头节点（因为我们是反向遍历）
      // 最后一个未被移除的节点将成为新的头节点
      head = link
    }

    // 恢复依赖的前一个活跃链接状态
    // 这对于处理嵌套 effect 或 computed 的执行上下文非常重要
    link.dep.activeLink = link.prevActiveLink
    // 清理临时存储的前一个活跃链接引用
    link.prevActiveLink = undefined

    // 继续处理前一个依赖
    link = prev
  }

  // 更新订阅者的依赖链表头尾指针
  // 经过清理后，只保留在本次执行中实际使用的依赖
  sub.deps = head
  sub.depsTail = tail
}

/**
 * 检查订阅者是否需要重新执行（脏状态检查）
 *
 * 这是 Vue 3 响应式系统中的核心优化机制，通过版本对比高效判断
 * 订阅者的依赖是否发生了变化，从而决定是否需要重新执行
 *
 * 应用场景：
 * 1. 计算属性的懒求值机制：只有在依赖变化时才重新计算
 * 2. ReactiveEffect 的条件执行：避免不必要的副作用执行
 * 3. SSR 环境下的性能优化：减少无意义的重新渲染
 *
 * 性能优化原理：
 * - 版本比较：使用数值比较而非深度对比，时间复杂度 O(n)
 * - 懒计算：计算属性依赖只在需要时才重新求值
 * - 短路原理：发现第一个变化的依赖即立即返回 true
 *
 * @param sub 需要检查的订阅者（ReactiveEffect 或 ComputedRefImpl）
 * @returns true 表示订阅者需要重新执行；false 表示可以使用缓存结果
 */
function isDirty(sub: Subscriber): boolean {
  // 遍历订阅者的所有依赖项，检查是否有任何依赖发生了变化
  for (let link = sub.deps; link; link = link.nextDep) {
    // 检查依赖的版本号是否与链接中记录的版本号不同
    // 版本号不同表示此依赖在上次收集后发生了变化
    if (
      link.dep.version !== link.version ||
      // 特殊处理：如果依赖是计算属性，需要递归检查
      (link.dep.computed &&
        // 尝试刷新计算属性（可能会触发其重新计算）
        // 或者刷新后版本号仍然不同（计算属性本身的依赖发生了变化）
        (refreshComputed(link.dep.computed) ||
          link.dep.version !== link.version))
    ) {
      // 发现任何一个依赖变化，立即返回 true（短路原理）
      return true
    }
  }

  // 向后兼容性检查：支持手动设置 _dirty 标志的三方库
  // 例如 Pinia 的测试模块等历史遗留的 API 使用方式
  // @ts-expect-error only for backwards compatibility where libs manually set
  // this flag - e.g. Pinia's testing module
  if (sub._dirty) {
    // 如果手动设置了 _dirty 标志，也认为需要重新执行
    return true
  }

  // 所有依赖都没有变化，且没有手动设置脚脏标志
  // 订阅者不需要重新执行，可以使用缓存结果
  return false
}

/**
 * 刷新计算属性的值，实现懒求值和缓存机制
 * 返回 false 表示刷新失败
 * @internal
 */
export function refreshComputed(computed: ComputedRefImpl): undefined {
  // 如果计算属性正在跟踪依赖且不是脏值状态，则直接返回
  if (
    computed.flags & EffectFlags.TRACKING &&
    !(computed.flags & EffectFlags.DIRTY)
  ) {
    return
  }
  // 清除脏值标志，表示即将进行重新计算
  computed.flags &= ~EffectFlags.DIRTY

  // 全局版本号快速路径：如果自上次刷新以来没有响应式数据变化，
  // 则直接使用缓存值
  if (computed.globalVersion === globalVersion) {
    return
  }
  // 同步全局版本号
  computed.globalVersion = globalVersion

  // 在 SSR 环境中不会有渲染副作用，所以计算属性没有订阅者
  // 因此不能依赖脏值检查。在 SSR 中计算属性始终重新求值，
  // 并依赖上面的 globalVersion 快速路径进行缓存。
  // #12337 如果计算属性没有依赖（不依赖任何响应式数据）并且已经求值，
  // 则不需要重新求值。
  if (
    !computed.isSSR &&
    computed.flags & EffectFlags.EVALUATED &&
    ((!computed.deps && !(computed as any)._dirty) || !isDirty(computed))
  ) {
    return
  }
  // 设置运行标志，表示计算属性正在执行
  computed.flags |= EffectFlags.RUNNING

  // 保存计算属性的依赖管理器
  const dep = computed.dep
  // 保存当前的全局状态，以便后续恢复
  const prevSub = activeSub
  const prevShouldTrack = shouldTrack
  // 设置当前计算属性为活跃订阅者，开启依赖收集
  activeSub = computed
  shouldTrack = true

  try {
    // 准备依赖收集：将所有现有依赖标记为待验证状态
    prepareDeps(computed)
    // 执行计算函数，获取新值实际上调用的就是用户初始化传入的getter函数
    const value = computed.fn(computed._value)
    // 如果是初次计算或者值发生了变化
    if (dep.version === 0 || hasChanged(value, computed._value)) {
      // 标记为已求值状态
      computed.flags |= EffectFlags.EVALUATED
      // 更新缓存值
      computed._value = value
      // 更新依赖版本号，通知依赖此计算属性的订阅者
      dep.version++
    }
  } catch (err) {
    // 即使出错也要更新版本号，保证一致性
    dep.version++
    throw err
  } finally {
    // 恢复全局状态
    activeSub = prevSub
    shouldTrack = prevShouldTrack
    // 清理无用的依赖
    cleanupDeps(computed)
    // 清除运行标志
    computed.flags &= ~EffectFlags.RUNNING
  }
}

/**
 * 从依赖的订阅者链表中移除指定的订阅者链接
 * 这是响应式系统中断开依赖关系的核心函数，确保内存的正确释放
 *
 * 主要功能：
 * 1. 维护双向链表结构的完整性（更新前后节点的指针）
 * 2. 处理特殊情况（头节点、尾节点的更新）
 * 3. 处理计算属性的级联清理（当计算属性失去所有订阅者时）
 * 4. 自动清理无用的依赖映射（避免内存泄漏）
 *
 * 设计特点：
 * - 支持软删除模式（不减少订阅者计数，用于计算属性的递归清理）
 * - 自动垃圾回收机制（当依赖无订阅者时自动从映射表删除）
 * - 级联清理计算属性依赖（防止计算属性相关的内存泄漏）
 *
 * @param link 要移除的订阅者链接（包含dep、prevSub、nextSub等信息）
 * @param soft 软删除模式，true时不减少dep.sc计数（用于计算属性的递归清理）
 */
function removeSub(link: Link, soft = false) {
  // 解构获取链接相关的节点信息
  const { dep, prevSub, nextSub } = link

  // 处理前一个订阅者节点的连接
  if (prevSub) {
    // 将前一个节点的 nextSub 指向当前节点的下一个节点
    // 这样就跳过了当前要删除的节点
    prevSub.nextSub = nextSub
    // 清理当前节点对前一个节点的引用，防止内存泄漏
    link.prevSub = undefined
  }

  // 处理下一个订阅者节点的连接
  if (nextSub) {
    // 将下一个节点的 prevSub 指向当前节点的前一个节点
    nextSub.prevSub = prevSub
    // 清理当前节点对下一个节点的引用，防止内存泄漏
    link.nextSub = undefined
  }

  // 开发模式：处理依赖的头节点指针更新
  if (__DEV__ && dep.subsHead === link) {
    // 如果要删除的是头节点，将头指针指向下一个节点
    // subsHead 主要用于开发模式下的调试支持
    dep.subsHead = nextSub
  }

  // 处理依赖的尾节点指针更新
  if (dep.subs === link) {
    // 如果要删除的是尾节点，将尾指针指向前一个节点
    // dep.subs 始终指向订阅者链表的尾部（最新添加的订阅者）
    dep.subs = prevSub

    // 特殊处理：计算属性的级联清理机制
    if (!prevSub && dep.computed) {
      // 如果删除尾节点后链表为空（!prevSub）且这是一个计算属性的依赖
      // 需要执行计算属性的完整清理流程

      // 停止计算属性的依赖跟踪，标记其不再活跃
      // 这防止在清理过程中产生新的依赖关系
      dep.computed.flags &= ~EffectFlags.TRACKING

      // 递归清理计算属性自身的所有依赖项
      // 遍历计算属性依赖的其他响应式数据
      for (let l = dep.computed.deps; l; l = l.nextDep) {
        // 对每个依赖执行"软删除"
        // soft=true 表示不减少依赖的订阅者计数
        // 这是因为计算属性仍然保持对这些依赖的引用
        // 只是标记这些依赖在当前上下文中不再活跃
        removeSub(l, true)
      }
    }
  }

  // 处理依赖的自动清理机制
  if (!soft && !--dep.sc && dep.map) {
    // 只有在非软删除模式下才减少订阅者计数并检查是否需要清理
    // !--dep.sc: 先减少计数，然后检查是否为0
    // dep.map: 确保这是一个可以被清理的属性依赖

    // #11979 性能优化：自动清理无订阅者的属性依赖
    // 当一个属性依赖不再有任何订阅者时，从映射表中删除它
    // 这主要针对以下场景：
    // - 对象保留在内存中，但只有部分属性在某个时间点被跟踪
    // - 避免废弃的依赖项占用内存空间
    // - 保持依赖映射表的精简和高效
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
