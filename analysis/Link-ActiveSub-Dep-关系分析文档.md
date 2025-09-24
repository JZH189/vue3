# Link、activeSub、Dep 三者关系分析文档

## 1. 概述

在 Vue 3 的响应式系统中，**Link**、**activeSub**、**Dep** 三个概念构成了响应式依赖收集和触发机制的核心三角关系。它们共同实现了精确的响应式更新，是理解 Vue 3 响应式原理的关键。

## 2. 三个概念的定义

### 2.1 activeSub（活跃订阅者）

```typescript
// packages/reactivity/src/effect.ts:38
export let activeSub: Subscriber | undefined
```

**activeSub** 是一个**全局变量**，表示当前正在执行的订阅者（Subscriber）。

**作用**：

- 标识当前哪个 effect 或 computed 正在运行
- 作为依赖收集的"目标"，确定响应式数据应该关联到哪个订阅者
- 支持嵌套执行场景的栈式管理

**主要实现类型**：

- `ReactiveEffect` - 响应式副作用（effect、watch、组件更新等）
- `ComputedRefImpl` - 计算属性

### 2.2 Dep（依赖项）

```typescript
// packages/reactivity/src/dep.ts:76
export class Dep {
  version = 0 // 版本号
  activeLink?: Link = undefined // 当前活跃链接
  subs?: Link = undefined // 订阅者链表尾部
  subsHead?: Link // 订阅者链表头部
  sc: number = 0 // 订阅者计数
  // ...
}
```

**Dep** 是依赖项的抽象，每个响应式属性都有对应的 Dep 实例。

**作用**：

- 管理订阅了特定响应式属性的所有订阅者
- 提供依赖收集方法 `track()`
- 提供依赖触发方法 `trigger()` 和 `notify()`
- 维护订阅者的双向链表结构

### 2.3 Link（链接桥梁）

```typescript
// packages/reactivity/src/dep.ts:25
export class Link {
  version: number // 版本号
  nextDep?: Link // 指向下一个依赖
  prevDep?: Link // 指向上一个依赖
  nextSub?: Link // 指向下一个订阅者
  prevSub?: Link // 指向上一个订阅者

  constructor(
    public sub: Subscriber, // 订阅者引用
    public dep: Dep, // 依赖项引用
  ) {
    this.version = dep.version
  }
}
```

**Link** 是连接 Subscriber 和 Dep 的桥梁对象。

**作用**：

- 表示一个特定的订阅关系（某个订阅者依赖某个响应式属性）
- 同时存在于两个双向链表中：
  - 订阅者的依赖链表（从 subscriber.deps 开始）
  - 依赖项的订阅者链表（从 dep.subs 开始）
- 支持高效的链表操作和内存管理

## 3. 三者之间的关系

### 3.1 整体关系图

```
┌─────────────────────┐
│   Global Context   │
│                     │
│  activeSub ────────┼──────────┐
│  (当前活跃订阅者)    │          │
└─────────────────────┘          │
                                │
                                ▼
┌─────────────────────┐    ┌─────────────────────┐
│   Subscriber        │    │        Dep          │
│  (ReactiveEffect/   │    │   (响应式属性的      │
│   ComputedRefImpl)  │    │    依赖管理器)       │
│                     │    │                     │
│  deps ─────────────┼────┼─→ subs               │
│  depsTail ─────────┼────┼─→ activeLink         │
│                     │    │    version          │
└─────────────────────┘    └─────────────────────┘
            ▲                         ▲
            │                         │
            │    ┌─────────────────────┐    │
            └────┤       Link          ├────┘
                 │    (连接桥梁)        │
                 │                     │
                 │  sub: Subscriber    │
                 │  dep: Dep           │
                 │  version: number    │
                 │  nextDep/prevDep    │
                 │  nextSub/prevSub    │
                 └─────────────────────┘
```

### 3.2 数据流动关系

```
1. 执行阶段：
   effect.run() → activeSub = effect → 访问 obj.count

2. 依赖收集阶段：
   obj.count 的 getter → dep.track() → 检查 activeSub → 创建 Link

3. 链接建立：
   Link.sub = activeSub (当前 effect)
   Link.dep = dep (obj.count 的依赖)

4. 双向链表维护：
   effect.deps ← Link → dep.subs

5. 变更触发：
   obj.count = newValue → dep.trigger() → 遍历 dep.subs → 通知所有 Link.sub
```

## 4. 详细工作流程

### 4.1 依赖收集流程

```typescript
// 1. effect 开始执行
function runEffect() {
  const prevSub = activeSub
  activeSub = currentEffect  // 设置全局活跃订阅者

  try {
    // 2. 执行用户函数，访问响应式数据
    currentEffect.fn() // 例如：() => console.log(obj.count)
  } finally {
    activeSub = prevSub  // 恢复之前的活跃订阅者
  }
}

// 3. 访问 obj.count 时触发 getter
function get(target, key) {
  const dep = getDep(target, key)  // 获取对应的 Dep
  dep.track()  // 进行依赖收集
  return target[key]
}

// 4. Dep.track() 方法
track(): Link | undefined {
  // 检查三重安全条件
  if (!activeSub || !shouldTrack || activeSub === this.computed) {
    return
  }

  // 获取或创建 Link
  let link = this.activeLink
  if (link === undefined || link.sub !== activeSub) {
    // 创建新的 Link 连接 activeSub 和当前 Dep
    link = this.activeLink = new Link(activeSub, this)

    // 将 Link 添加到 activeSub 的依赖链表尾部
    if (!activeSub.deps) {
      activeSub.deps = activeSub.depsTail = link
    } else {
      link.prevDep = activeSub.depsTail
      activeSub.depsTail!.nextDep = link
      activeSub.depsTail = link
    }

    // 将 Link 添加到 Dep 的订阅者链表
    addSub(link)
  }

  return link
}
```

### 4.2 依赖触发流程

```typescript
// 1. 响应式数据变更
function set(target, key, value) {
  const dep = getDep(target, key)
  target[key] = value
  dep.trigger()  // 触发依赖更新
}

// 2. Dep.trigger() 方法
trigger(): void {
  this.version++      // 递增本地版本
  globalVersion++     // 递增全局版本
  this.notify()       // 通知所有订阅者
}

// 3. Dep.notify() 方法
notify(): void {
  startBatch()  // 开始批处理

  try {
    // 遍历所有订阅者 Link，反向遍历确保正确的执行顺序
    for (let link = this.subs; link; link = link.prevSub) {
      if (link.sub.notify()) {
        // 如果是 computed，需要递归通知其依赖
        (link.sub as ComputedRefImpl).dep.notify()
      }
    }
  } finally {
    endBatch()  // 结束批处理
  }
}
```

### 4.3 链表结构详解

每个 Link 同时存在于两个双向链表中：

**1. Subscriber 的依赖链表**

```
Subscriber:
  deps ────→ Link1 ←→ Link2 ←→ Link3 ←──── depsTail
             │       │       │
             ▼       ▼       ▼
            Dep1    Dep2    Dep3
```

**2. Dep 的订阅者链表**

```
Dep:
  subs ────→ Link1 ←→ Link2 ←→ Link3 ←──── subsHead
             │       │       │
             ▼       ▼       ▼
         Subscriber1 Subscriber2 Subscriber3
```

## 5. 关键设计特性

### 5.1 版本控制机制

**目的**：避免不必要的重复计算和更新

```typescript
// Dep 和 Link 都有版本号
class Dep {
  version = 0 // 每次变更时递增
}

class Link {
  version: number // 同步到对应 Dep 的版本

  // 在依赖收集过程中
  // version === -1 表示 Link 可以复用
  // version === dep.version 表示 Link 是最新的
}
```

### 5.2 智能复用机制

**目的**：减少对象创建和内存分配

```typescript
track(): Link | undefined {
  let link = this.activeLink

  if (link === undefined || link.sub !== activeSub) {
    // 情况1：创建新 Link
    link = this.activeLink = new Link(activeSub, this)
    addSub(link)
  } else if (link.version === -1) {
    // 情况2：复用现有 Link，同步版本并移动到链表尾部（LRU策略）
    link.version = this.version
    moveToTail(link)
  }

  return link
}
```

### 5.3 三重安全检查

**目的**：确保依赖收集的准确性和系统稳定性

```typescript
if (!activeSub || !shouldTrack || activeSub === this.computed) {
  return // 不进行依赖收集
}

// 检查1: !activeSub - 没有活跃的订阅者
// 检查2: !shouldTrack - 全局禁用依赖跟踪
// 检查3: activeSub === this.computed - 避免计算属性自循环依赖
```

## 6. 实际应用场景

### 6.1 基础响应式场景

```typescript
import { reactive, effect } from 'vue'

const obj = reactive({ count: 0 })

effect(() => {
  console.log('count:', obj.count) // 依赖收集
})

obj.count++ // 触发更新
```

**内部流程**：

1. `effect()` 创建 `ReactiveEffect` 实例
2. `effect.run()` 设置 `activeSub = effect`
3. 访问 `obj.count` 触发 `dep.track()`
4. 创建 `Link(effect, countDep)` 建立关联
5. `obj.count++` 触发 `countDep.trigger()`
6. 遍历 `countDep.subs` 找到对应的 `Link`
7. 调用 `effect.notify()` 重新执行 effect

### 6.2 计算属性场景

```typescript
import { reactive, computed, effect } from 'vue'

const obj = reactive({ a: 1, b: 2 })
const sum = computed(() => obj.a + obj.b)

effect(() => {
  console.log('sum:', sum.value)
})

obj.a = 10 // 触发级联更新
```

**内部流程**：

1. 访问 `sum.value` 触发 `refreshComputed()`
2. 设置 `activeSub = sum`（ComputedRefImpl）
3. 执行计算函数 `() => obj.a + obj.b`
4. 访问 `obj.a` 和 `obj.b` 分别创建 Link
5. `obj.a = 10` 触发 `aDep.trigger()`
6. 通知 `sum` 重新计算并触发 `sum.dep.trigger()`
7. 最终通知依赖 `sum` 的 effect

### 6.3 嵌套 effect 场景

```typescript
effect(() => {
  console.log('outer:', obj.a)

  effect(() => {
    console.log('inner:', obj.b)
  })

  console.log('outer again:', obj.a)
})
```

**activeSub 变化**：

```
开始: activeSub = undefined
外层 effect 开始: activeSub = outerEffect
访问 obj.a: 创建 Link(outerEffect, aDep)
内层 effect 开始: activeSub = innerEffect (保存 outerEffect)
访问 obj.b: 创建 Link(innerEffect, bDep)
内层 effect 结束: activeSub = outerEffect (恢复)
再次访问 obj.a: 复用已有 Link
外层 effect 结束: activeSub = undefined
```

## 7. 性能优化特性

### 7.1 链表复用和 LRU 策略

- **复用机制**：避免重复创建 Link 对象
- **LRU 策略**：将最近访问的依赖移动到链表尾部
- **版本控制**：通过版本号快速判断是否需要更新

### 7.2 批处理机制

- **startBatch/endBatch**：将多个更新合并为一次批处理
- **防重复通知**：NOTIFIED 标志避免同一批次中的重复执行

### 7.3 内存管理

- **弱引用清理**：通过 WeakMap 存储依赖关系，支持自动垃圾回收
- **双向链表**：高效的添加/删除操作，O(1) 时间复杂度

## 8. 调试和开发工具支持

### 8.1 开发环境特性

```typescript
if (__DEV__) {
  // onTrack 钩子：依赖收集时调用
  activeSub.onTrack({
    effect: activeSub,
    target,
    type: TrackOpTypes.GET,
    key,
  })

  // onTrigger 钩子：依赖触发时调用
  subscriber.onTrigger({
    effect: subscriber,
    target,
    type: TriggerOpTypes.SET,
    key,
    newValue,
    oldValue,
  })
}
```

### 8.2 调试信息

- **详细的依赖关系**：可以追踪每个属性的订阅者
- **变更历史**：记录属性变更的完整信息
- **性能分析**：通过版本号和计数器监控系统性能

## 9. 总结

**Link、activeSub、Dep 三者构成了 Vue 3 响应式系统的核心架构**：

1. **activeSub** 作为"当前上下文"，标识哪个订阅者正在执行
2. **Dep** 作为"数据中心"，管理特定响应式属性的所有订阅关系
3. **Link** 作为"连接桥梁"，精确表示订阅者与依赖项之间的关系

**这种设计的优势**：

- **精确性**：通过 Link 建立精确的多对多关系
- **高效性**：双向链表和版本控制提供 O(1) 操作和智能缓存
- **可维护性**：清晰的职责分离和模块化设计
- **可扩展性**：支持嵌套、计算属性、异步更新等复杂场景

**关键理解点**：

- activeSub 是"谁"在访问数据
- Dep 是"什么"数据被访问
- Link 是"谁访问了什么"的具体记录

这三者的协同工作使得 Vue 3 能够实现精确、高效的响应式更新，是现代前端框架响应式设计的典型范例。
