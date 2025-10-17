import { extend, isArray, isIntegerKey, isMap, isSymbol } from '@vue/shared'
import type { ComputedRefImpl } from './computed'
import { type TrackOpTypes, TriggerOpTypes } from './constants'
import {
  type DebuggerEventExtraInfo,
  EffectFlags,
  type Subscriber,
  activeSub,
  endBatch,
  shouldTrack,
  startBatch,
} from './effect'

/**
 * Incremented every time a reactive change happens
 * This is used to give computed a fast path to avoid re-compute when nothing
 * has changed.
 */
export let globalVersion = 0

/**
 * 表示源（DEP）和订阅者（​​effect或computed）之间的联系。
 * DEPS和SUBS具有多一关系 - DEP和SUB之间的每个链接均由链接实例表示。
 *
 * 一个链接也是两个双关联列表中的节点 -一个用于跟踪其所有深度的链接，一个用于跟踪相关的DEP以跟踪其所有subs。
 */
export class Link {
  /**
   * 在每个效果运行之前，所有先前的DEP链接的版本都重置为-1
   *  -在运行期间，链接的版本与访问的源dep同步
   *  -运行后，清洁了与版本-1（从未使用过的）链接
   */
  version: number

  /**
   * 双连接列表的指针
   */
  nextDep?: Link //指向下一个依赖
  prevDep?: Link //指向上一个依赖
  nextSub?: Link //指向下一个订阅者
  prevSub?: Link //指向上一个订阅者
  prevActiveLink?: Link

  /**public sub: Subscriber 这种写法是TypeScript的参数属性（Parameter Properties）语法，它会：
自动声明一个名为sub的公共属性
在构造函数中自动将传入的参数赋值给this.sub 
* 这种设计体现了桥接模式的思想：
 * Link：作为桥梁连接Subscriber和Dep
 * sub属性：存储对订阅者的引用，用于后续的通信和操作
 * dep属性：存储对依赖的引用，用于版本同步等操作
*/
  constructor(
    public sub: Subscriber,
    public dep: Dep,
  ) {
    this.version = dep.version
    this.nextDep =
      this.prevDep =
      this.nextSub =
      this.prevSub =
      this.prevActiveLink =
        undefined
  }
}

/**
 * @internal
 */
export class Dep {
  /**
   * 版本号机制: 用于优化计算属性的重新计算
   * 全局同步: 与全局版本号globalVersion协同工作
   * 每次触发变化时版本号递增
   * 优化效果 1:计算属性缓存: 避免不必要的重新计算
   * 2:快速路径: 通过版本比较快速判断是否需要更新
   */
  version = 0
  /**
   * Link between this dep and the current active effect
   * 当前活跃链接: 指向当前正在建立或使用的Link实例
   * 优化访问: 缓存最近使用的链接，避免重复创建
   */
  activeLink?: Link = undefined

  /**
   * Doubly linked list representing the subscribing effects (tail)
   * 订阅者链表尾部: 双向链表的尾部指针
   * 订阅者管理: 管理所有订阅此依赖的Effect和Computed
   */
  subs?: Link = undefined

  /**
   * Doubly linked list representing the subscribing effects (head)
   * DEV only, for invoking onTrigger hooks in correct order
   * 开发模式专用: 仅在__DEV__模式下使用
   * 链表头部: 双向链表的头部指针
   * 调试支持: 用于按正确顺序调用onTrigger钩子
   */
  subsHead?: Link

  /**
   * For object property deps cleanup
   * 反向引用: 指向包含此Dep的Map  => type KeyToDepMap = Map<any, Dep>
   * 建立 Dep 实例与其所属映射表和 key 的反向引用
   * 便于从 Dep 实例反向查找其所属的映射表和键，支持依赖清理和调试功能
   */
  map?: KeyToDepMap = undefined

  /**
   * 属性标识: 存储此Dep对应的属性键
   * 调试信息: 在开发模式下提供更好的调试体验
   * 反向引用: 指向包含此Dep的Map  => type KeyToDepMap = Map<any, Dep>
   * 建立 Dep 实例与其所属映射表和 key 的反向引用
   * 便于从 Dep 实例反向查找其所属的映射表和键，支持依赖清理和调试功能
   * 后续可以通过removeSub函数中的dep.map.delete(dep.key)操作自动释放不再使用的依赖关系实现优化内存管理
   */
  key?: unknown = undefined

  /**
   * Subscriber counter
   * 记录订阅者数量
   * 当一个属性不再有任何订阅者时（dep.sc 为 0），系统需要：
   * 自动清理: 从 depsMap 中删除该属性的依赖项
   * 防止内存泄漏: 避免废弃的 Dep 实例占用内存
   * 回收资源: 释放不再使用的依赖关系
   */
  sc: number = 0

  /**
   * @internal
   * 标识这是Vue内部对象,响应式跳过: 防止Dep对象本身被响应式化,
   * 防止响应式系统对自身组件进行包装
   */
  readonly __v_skip = true
  // TODO isolatedDeclarations ReactiveFlags.SKIP

  constructor(public computed?: ComputedRefImpl | undefined) {
    if (__DEV__) {
      //开发模式: 显式初始化subsHead
      this.subsHead = undefined
    }
  }

  /**
   *设计优势
   * 智能复用: 避免重复创建Link对象
   * LRU优化: 将最近使用的依赖移到链表尾部
   * 版本同步: 确保Link版本与Dep版本一致
   */
  track(debugInfo?: DebuggerEventExtraInfo): Link | undefined {
    /**
     * 依赖收集的三重安全检查
     * 这是Vue 3响应式系统中最关键的依赖收集入口检查逻辑
     * 只有通过所有检查的情况下，才会进行实际的依赖收集操作
     */
    if (
      !activeSub || // 检查1: 当前是否有活跃的订阅者（effect或computed）
      !shouldTrack || // 检查2: 全局依赖跟踪开关是否开启
      activeSub === this.computed // 检查3: 避免computed对自身的循环依赖
    ) {
      // activeSub 初始化逻辑在packages\reactivity\src\effect.ts文件的ReactiveEffect.run方法中
      /**
       * 提前返回的三种情况分析：
       *
       * 情况1: !activeSub - 没有活跃的订阅者
       * - 原因: 当前没有effect或computed在执行（组件的模板渲染使用）
       * - 场景: 普通的属性访问，不在响应式上下文中
       * - 处理: 不收集依赖，避免无效的依赖关系
       *
       * 情况2: !shouldTrack - 全局禁用依赖跟踪
       * - 原因: 通过pauseTracking()主动禁用了依赖收集
       * - 场景: 某些操作需要访问响应式数据但不希望建立依赖关系
       * - 处理: 临时跳过依赖收集，常用于性能优化
       *
       * 情况3: activeSub === this.computed - 防止循环依赖
       * - 原因: computed正在计算自身，避免对自己建立依赖
       * - 场景: computed内部访问自己的值或相关属性
       * - 处理: 阻止循环引用，保证系统稳定性
       */
      return
    }

    //第一阶段：Link获取或创建
    let link = this.activeLink
    if (link === undefined || link.sub !== activeSub) {
      link = this.activeLink = new Link(activeSub, this)

      // add the link to the activeEffect as a dep (as tail)
      // 将Link添加到订阅者的依赖链表
      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link
      } else {
        link.prevDep = activeSub.depsTail
        activeSub.depsTail!.nextDep = link
        activeSub.depsTail = link
      }

      addSub(link)
    } else if (link.version === -1) {
      // 第二阶段：Link复用优化
      // reused from last run - already a sub, just sync version
      // 复用上次运行的Link
      link.version = this.version

      // If this dep has a next, it means it's not at the tail - move it to the
      // tail. This ensures the effect's dep list is in the order they are
      // accessed during evaluation.
      // 将Link移动到链表尾部（LRU策略）
      if (link.nextDep) {
        // 从当前位置移除
        const next = link.nextDep
        next.prevDep = link.prevDep
        if (link.prevDep) {
          link.prevDep.nextDep = next
        }
        // 插入到尾部
        link.prevDep = activeSub.depsTail
        link.nextDep = undefined
        activeSub.depsTail!.nextDep = link
        activeSub.depsTail = link

        // this was the head - point to the new head
        // 更新头部指针
        if (activeSub.deps === link) {
          activeSub.deps = next
        }
      }
    }

    if (__DEV__ && activeSub.onTrack) {
      activeSub.onTrack(
        extend(
          {
            effect: activeSub,
          },
          debugInfo,
        ),
      )
    }

    return link
  }

  /**
   * 版本机制
   * 本地版本: 用于此Dep的缓存失效
   * 全局版本: 用于整个系统的缓存失效
   */
  trigger(debugInfo?: DebuggerEventExtraInfo): void {
    // 更新本地版本
    this.version++
    // 更新全局版本
    globalVersion++
    // 通知所有订阅者
    this.notify(debugInfo)
  }

  notify(debugInfo?: DebuggerEventExtraInfo): void {
    startBatch()
    try {
      if (__DEV__) {
        // subs are notified and batched in reverse-order and then invoked in
        // original order at the end of the batch, but onTrigger hooks should
        // be invoked in original order here.
        // 遍历订阅者链表，从头部开始按原始顺序检查每个订阅者
        // head.nextSub 指向下一个订阅者，形成单向链表遍历
        // 根据项目规范，Vue 3注重性能优化：
        // 链表比数组更节省内存（不需要预分配连续空间）
        // 动态添加/删除订阅者更高效
        // 避免数组重新分配带来的性能开销
        for (let head = this.subsHead; head; head = head.nextSub) {
          // 检查两个条件：
          // 1. head.sub.onTrigger 存在 - 该订阅者有调试钩子函数
          // 2. !(head.sub.flags & EffectFlags.NOTIFIED) - 该订阅者在当前批次中还未被通知过
          // NOTIFIED 标志用于防止在同一批次中重复执行 onTrigger 钩子，这是批处理优化的关键
          if (head.sub.onTrigger && !(head.sub.flags & EffectFlags.NOTIFIED)) {
            //只有当 effect 还没有被通知过时，才执行 onTrigger 钩子
            // 避免在同一批次中重复触发 onTrigger
            /**
             * 为什么需要 NOTIFIED 标志？
              这是 Vue 3 的批处理优化机制：
              防止重复执行：在同一个响应式更新批次中，一个 effect 可能被多个依赖触发，但只应该执行一次
              性能优化：避免不必要的重复计算和 DOM 更新
              调试支持：确保 onTrigger 钩子在每个批次中只执行一次，提供准确的调试信息
             */
            head.sub.onTrigger(
              extend(
                {
                  effect: head.sub,
                },
                debugInfo,
              ),
            )
          }
        }
      }
      // 第二阶段：通知所有订阅者执行响应式更新
      // 使用反向遍历（从尾部到头部），这是批处理机制的重要设计
      // link.prevSub 指向前一个订阅者，实现反向链表遍历
      for (let link = this.subs; link; link = link.prevSub) {
        // 调用订阅者的 notify() 方法来触发更新
        //! 对于普通 effect，相当于执行了ReactiveEffect.notify() 然后调用了batch(this)将订阅者添加到批处理队列中.
        //! 对于 computed，相当于执行了ComputedRefImpl.notify() 然后调用了batch(this, true)将订阅者添加到批处理队列中.返回 true（标识这是一个computed属性）
        if (link.sub.notify()) {
          // 如果 notify() 返回 true，说明这是一个 computed 属性
          // 需要继续通知 computed 自身的依赖项（computed.dep）
          // 这里而不是在 computed.notify() 内部调用，是为了减少调用栈深度
          // 避免深度递归导致的性能问题和栈溢出风险
          ;(link.sub as ComputedRefImpl).dep.notify()
        }
      }
    } finally {
      endBatch()
    }
  }
}

/**
 * 将订阅者添加到依赖的订阅者链表中
 * 这是Vue 3响应式系统中建立依赖关系的核心函数
 *
 * @param link - 连接订阅者和依赖的Link对象
 */
function addSub(link: Link) {
  // 阶段1: 增加订阅者计数
  // sc = subscriber counter，记录当前依赖有多少个订阅者
  link.dep.sc++

  // 阶段2: 检查订阅者是否支持依赖跟踪
  // 只有具备TRACKING标志的订阅者才可以被添加到订阅者链表中
  if (link.sub.flags & EffectFlags.TRACKING) {
    // 阶段3: 处理computed属性的特殊情况
    const computed = link.dep.computed

    /**
     * computed的懒加载机制：
     * - computed在创建时不会立即计算，也不会订阅其依赖
     * - 只有当computed获得第一个订阅者时，才开始激活并订阅其依赖
     * - 这种设计避免了无用computed的内存开销和计算开销
     */
    if (computed && !link.dep.subs) {
      // computed获得第一个订阅者，开始激活

      // 设置computed的状态标志
      // TRACKING: 开启依赖跟踪，允许收集其依赖
      // DIRTY: 标记为脏数据，需要重新计算
      computed.flags |= EffectFlags.TRACKING | EffectFlags.DIRTY

      // 递归订阅computed的所有依赖
      // 这是懒加载的关键：只有在computed被需要时才建立其依赖关系
      for (let l = computed.deps; l; l = l.nextDep) {
        addSub(l) // 递归调用，为computed的每个依赖添加订阅
      }
    }

    // 阶段4: 将新的Link添加到订阅者链表中
    // Vue 3使用双向链表管理订阅者，subs指向链表尾部
    const currentTail = link.dep.subs

    // 检查是否已经在链表中（避免重复添加）
    if (currentTail !== link) {
      // 将当前尾部设为新link的前驱节点
      link.prevSub = currentTail

      // 如果存在尾部节点，就将其nextSub指向新link
      if (currentTail) currentTail.nextSub = link
    }

    // 阶段5: 开发模式下的头部指针初始化
    // subsHead用于在开发模式下按正确顺序调用onTrigger钩子
    if (__DEV__ && link.dep.subsHead === undefined) {
      link.dep.subsHead = link // 设置第一个订阅者为头部
    }

    // 阶段6: 更新尾部指针
    // 将新的link设为当前的尾部节点
    link.dep.subs = link
  }

  /**
   * 函数执行后的效果：
   * 1. 订阅者计数器增加
   * 2. 如果是computed的第一个订阅者，激活computed并建立其依赖关系
   * 3. 新的订阅者被添加到双向链表的尾部
   * 4. 保持链表的完整性和一致性
   */
}

// 存储{target->键 -> dep}连接的主要弱图。
// 从概念上讲，将依赖性视为维护一组订阅者的DEP类更容易，但是我们只是将它们存储为原始地图即可减少内存开销。
type KeyToDepMap = Map<any, Dep>

export const targetMap: WeakMap<object, KeyToDepMap> = new WeakMap()

export const ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Object iterate' : '',
)
export const MAP_KEY_ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Map keys iterate' : '',
)
export const ARRAY_ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Array iterate' : '',
)

/**
 * 追踪对响应式属性的访问，建立依赖关系
 *
 * 该函数是 Vue 3 响应式系统的核心函数之一，负责在属性读取时收集依赖。
 * 它会检查当前正在运行的副作用（effect），并将其记录为依赖项，
 * 从而建立属性与副作用之间的依赖关系。
 *
 * @param target - 持有响应式属性的目标对象
 * @param type - 定义对响应式属性的访问类型（GET、ITERATE 等）
 * @param key - 要追踪的响应式属性的标识符
 */
export function track(target: object, type: TrackOpTypes, key: unknown): void {
  // 只有在允许追踪且存在活跃的订阅者（副作用）时才进行依赖收集
  if (shouldTrack && activeSub) {
    // 从全局 targetMap 中获取目标对象对应的依赖映射表
    let depsMap = targetMap.get(target)

    // 如果目标对象还没有依赖映射表，则创建一个新的
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }

    // 从依赖映射表中获取指定 key 对应的 Dep 实例
    let dep = depsMap.get(key)

    // 如果该 key 还没有对应的 Dep 实例，则创建一个新的
    if (!dep) {
      depsMap.set(key, (dep = new Dep()))
      /*
      反向引用使得：
      向上查找: Dep 实例可以找到它在哪个映射表中
      精确删除: 知道要删除的具体 key 是什么
      结构完整: 维护映射关系的一致性
      */
      dep.map = depsMap
      dep.key = key
    }

    // 调用 Dep 实例的 track 方法建立依赖关系
    if (__DEV__) {
      // 开发环境下传递详细的调试信息
      dep.track({
        target,
        type,
        key,
      })
    } else {
      // 生产环境下只调用基础的 track 方法，提升性能
      dep.track()
    }
  }
}

/**
 * 响应式更新触发函数 - Vue 3 响应式系统的核心函数
 * 负责根据不同的操作类型触发相关的响应式副作用
 * 实现了精确的依赖通知机制，确保只有相关的 effect 被执行
 *
 * 功能特性：
 * - 支持多种操作类型：ADD、SET、DELETE、CLEAR
 * - 对数组和 Map/Set 集合类型进行特化处理
 * - 支持批量更新优化，提高性能
 * - 在开发模式下提供详细的调试信息
 *
 * 查找与目标对象（或特定属性）相关的所有依赖，
 * 并触发其中存储的副作用。
 *
 * @param target 响应式对象的原始目标，指定哪个响应式对象的副作用应该被执行
 * @param type 操作类型，定义了需要触发副作用的操作类型
 * @param key 可选，可用于定位目标对象中的特定响应式属性
 * @param newValue 可选，新设置的值
 * @param oldValue 可选，原有的值
 * @param oldTarget 可选，用于 Map/Set 类型的原始目标对象
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>,
): void {
  // 从全局依赖映射表中获取目标对象的依赖映射
  const depsMap = targetMap.get(target)

  // 如果目标对象从未被追踪，则无需触发任何副作用
  if (!depsMap) {
    // 增加全局版本号，用于标记系统状态变化
    // 这有助于某些优化策略的实现
    globalVersion++
    return
  }

  // 定义内部辅助函数，用于执行单个依赖的所有副作用
  const run = (dep: Dep | undefined) => {
    if (dep) {
      if (__DEV__) {
        // 开发模式下，传递详细的调试信息以便进行问题诊断
        dep.trigger({
          target, // 目标对象
          type, // 操作类型
          key, // 变化的属性键
          newValue, // 新值
          oldValue, // 旧值
          oldTarget, // 原始目标对象（针对 Map/Set）
        })
      } else {
        // 生产模式下，只调用简化的 trigger 方法，提高性能
        dep.trigger()
      }
    }
  }

  startBatch()

  // 根据不同的操作类型执行不同的触发逻辑
  if (type === TriggerOpTypes.CLEAR) {
    // 集合被清空的情况（如 Map.clear() 或 Set.clear()）
    // 需要触发目标对象的所有副作用，因为所有元素都被影响
    //(value, key, map) => void
    depsMap.forEach(run)
  } else {
    // 缓存目标对象的类型检查结果，避免重复计算
    const targetIsArray = isArray(target)
    // 检查是否为数组索引操作（数组 + 整数键）
    const isArrayIndex = targetIsArray && isIntegerKey(key)

    // 特殊处理数组长度变化的情况
    if (targetIsArray && key === 'length') {
      // 当数组长度发生变化时，需要特殊处理
      const newLength = Number(newValue)

      // 遍历所有依赖，检查哪些需要被触发
      depsMap.forEach((dep, key) => {
        if (
          key === 'length' || // length 属性本身的依赖
          key === ARRAY_ITERATE_KEY || // 数组迭代操作的依赖
          (!isSymbol(key) && key >= newLength) // 被删除的索引位置的依赖
        ) {
          run(dep)
        }
      })
    } else {
      // 处理 SET | ADD | DELETE 操作的触发逻辑
      /*
       * 使用 void 0 而不是 undefined 的原因：
       * 1. 代码的健壮性：确保获得真正的 undefined
       * 2. 性能考虑：代码压缩时更短
       * 3. 编程习惯：许多大型 JavaScript 库都采用这种写法
       * 4. 向后兼容：确保在各种环境下都能正常工作
       */
      // 触发特定属性键的依赖（如果存在）
      // 同时处理 undefined 键的情况（用于某些特殊场景）
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key))
      }

      // 对于数组索引的数值变化，需要触发数组迭代相关的副作用
      // 注意：length 属性的处理在上面已经完成
      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY))
      }

      // 根据具体的操作类型执行相应的迭代键触发逻辑
      // 处理 ADD | DELETE | Map.SET 操作的迭代相关副作用
      switch (type) {
        case TriggerOpTypes.ADD:
          if (!targetIsArray) {
            // 对象添加属性：触发对象迭代相关的副作用
            run(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              // Map 类型还需要触发键迭代相关的副作用
              run(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          } else if (isArrayIndex) {
            // 数组添加新索引 -> 引起长度变化
            // 需要触发 length 属性相关的副作用
            run(depsMap.get('length'))
          }
          break

        case TriggerOpTypes.DELETE:
          if (!targetIsArray) {
            // 对象删除属性：触发对象迭代相关的副作用
            run(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              // Map 类型还需要触发键迭代相关的副作用
              run(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          }
          break

        case TriggerOpTypes.SET:
          if (isMap(target)) {
            // Map 设置操作：可能会影响迭代结果
            run(depsMap.get(ITERATE_KEY))
          }
          break
      }
    }
  }

  // 结束批量更新，此时所有的响应式副作用将被除重并执行
  // 这是性能优化的关键，避免了同一个 effect 在一次操作中被多次执行
  endBatch()
}

export function getDepFromReactive(
  object: any,
  key: string | number | symbol,
): Dep | undefined {
  const depMap = targetMap.get(object)
  return depMap && depMap.get(key)
}
