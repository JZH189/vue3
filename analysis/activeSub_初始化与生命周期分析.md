# activeSub 初始化与生命周期分析

## 1. activeSub 的定义与作用

[activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L38-L38) 是 Vue 3 响应式系统中的**全局变量**，用于跟踪当前正在执行的订阅者（Subscriber）。

```typescript
// packages/reactivity/src/effect.ts:38
export let activeSub: Subscriber | undefined
```

### 1.1 Subscriber 接口定义

```typescript
export interface Subscriber extends DebuggerOptions {
  deps?: Link // 依赖链表头部
  depsTail?: Link // 依赖链表尾部
  flags: EffectFlags // 状态标志
  next?: Subscriber // 批处理链表中的下一个订阅者
  notify(): true | void // 通知方法
}
```

### 1.2 主要的 Subscriber 实现

1. **ReactiveEffect** - 响应式副作用
2. **ComputedRefImpl** - 计算属性

## 2. activeSub 的初始化时机

### 2.1 ReactiveEffect 中的初始化

当调用 [`ReactiveEffect.run()`](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L170-L200) 方法时：

```typescript
run(): T {
  if (!(this.flags & EffectFlags.ACTIVE)) {
    return this.fn()
  }

  this.flags |= EffectFlags.RUNNING
  cleanupEffect(this)
  prepareDeps(this)

  // ⭐ 关键步骤：设置 activeSub
  const prevEffect = activeSub      // 保存之前的 activeSub
  const prevShouldTrack = shouldTrack
  activeSub = this                  // 🔥 初始化为当前 ReactiveEffect
  shouldTrack = true

  try {
    return this.fn()                // 执行用户函数，触发响应式依赖收集
  } finally {
    cleanupDeps(this)
    activeSub = prevEffect          // 🔄 恢复之前的 activeSub
    shouldTrack = prevShouldTrack
    this.flags &= ~EffectFlags.RUNNING
  }
}
```

### 2.2 ComputedRefImpl 中的初始化

当调用 [`refreshComputed()`](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L410-L440) 更新计算属性时：

```typescript
function refreshComputed(computed: ComputedRefImpl): void {
  // ... 其他逻辑

  computed.flags |= EffectFlags.RUNNING
  const dep = computed.dep

  // ⭐ 关键步骤：设置 activeSub
  const prevSub = activeSub // 保存之前的 activeSub
  const prevShouldTrack = shouldTrack
  activeSub = computed // 🔥 初始化为当前 ComputedRefImpl
  shouldTrack = true

  try {
    prepareDeps(computed)
    const value = computed.fn(computed._value) // 执行计算函数
    // ... 处理结果
  } finally {
    activeSub = prevSub // 🔄 恢复之前的 activeSub
    shouldTrack = prevShouldTrack
    cleanupDeps(computed)
    computed.flags &= ~EffectFlags.RUNNING
  }
}
```

## 3. activeSub 的完整生命周期

### 3.1 初始状态

```typescript
// 全局初始化时
export let activeSub: Subscriber | undefined = undefined
```

### 3.2 执行流程示例

#### 场景1：effect 函数调用

```typescript
// 用户代码
import { effect, reactive } from 'vue'

const obj = reactive({ count: 0 })

effect(() => {
  console.log(obj.count) // 访问响应式属性
})
```

**执行流程**：

1. `effect()` 创建 `ReactiveEffect` 实例
2. 调用 `e.run()` 方法
3. **`activeSub = this`** (设置为当前 ReactiveEffect)
4. 执行 `fn()` → 访问 `obj.count`
5. 触发 `track()` 依赖收集 → 检查 `activeSub`
6. **`activeSub = prevEffect`** (恢复之前的值)

#### 场景2：computed 属性访问

```typescript
// 用户代码
import { computed, reactive } from 'vue'

const obj = reactive({ count: 0 })
const doubled = computed(() => obj.count * 2)

console.log(doubled.value) // 访问计算属性
```

**执行流程**：

1. 访问 `doubled.value`
2. 调用 `refreshComputed(computed)`
3. **`activeSub = computed`** (设置为当前 ComputedRefImpl)
4. 执行计算函数 `() => obj.count * 2`
5. 访问 `obj.count` → 触发依赖收集
6. **`activeSub = prevSub`** (恢复之前的值)

### 3.3 嵌套场景的处理

当存在嵌套的 effect 或 computed 时，Vue 3 使用**栈式管理**：

```typescript
// 示例：嵌套 effect
effect(() => {
  // activeSub = effect1
  console.log('outer')

  effect(() => {
    // activeSub = effect2 (保存 effect1)
    console.log('inner')
  }) // activeSub = effect1 (恢复)

  console.log('outer again')
}) // activeSub = undefined (恢复)
```

## 4. activeSub 在依赖收集中的作用

### 4.1 track() 方法中的检查

在 [`Dep.track()`](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\dep.ts#L152-L195) 方法中：

```typescript
track(debugInfo?: DebuggerEventExtraInfo): Link | undefined {
  // ⭐ 关键检查：确保有活跃的订阅者
  if (!activeSub || !shouldTrack || activeSub === this.computed) {
    return // 🚫 没有 activeSub 时不进行依赖收集
  }

  // 🔗 建立 activeSub 与当前 Dep 的链接关系
  let link = this.activeLink
  if (link === undefined || link.sub !== activeSub) {
    link = this.activeLink = new Link(activeSub, this)
    // ... 添加到依赖链表
  }

  return link
}
```

### 4.2 三个条件的含义

```typescript
if (!activeSub || !shouldTrack || activeSub === this.computed) {
  return
}
```

1. **`!activeSub`** - 没有活跃的订阅者，无需收集依赖
2. **`!shouldTrack`** - 全局禁用依赖跟踪（通过 `pauseTracking()` 设置）
3. **`activeSub === this.computed`** - 避免计算属性对自身的循环依赖

## 5. 实际应用场景分析

### 5.1 组件渲染过程

```typescript
// 组件更新时的 activeSub 变化
function updateComponent(instance) {
  const renderEffect = instance.update // ReactiveEffect 实例

  renderEffect.run() // activeSub = renderEffect
  // 在渲染函数中访问响应式数据时，会收集依赖到 renderEffect
}
```

### 5.2 watch 监听器

```typescript
import { watch, reactive } from 'vue'

const obj = reactive({ count: 0 })

watch(
  () => obj.count,
  newVal => {
    console.log('count changed:', newVal)
  },
)

// 内部实现类似：
// const watchEffect = new ReactiveEffect(() => obj.count)
// watchEffect.run() // activeSub = watchEffect，收集对 obj.count 的依赖
```

## 6. 错误处理与调试

### 6.1 开发环境检查

```typescript
// 在 ReactiveEffect.run() 的 finally 块中
if (__DEV__ && activeSub !== this) {
  warn(
    'Active effect was not restored correctly - ' +
      'this is likely a Vue internal bug.',
  )
}
```

### 6.2 cleanup 时的处理

```typescript
function cleanupEffect(e: ReactiveEffect) {
  const { cleanup } = e
  e.cleanup = undefined
  if (cleanup) {
    // 🔧 临时清除 activeSub，避免在清理过程中收集依赖
    const prevSub = activeSub
    activeSub = undefined
    try {
      cleanup()
    } finally {
      activeSub = prevSub // 恢复
    }
  }
}
```

## 7. 总结

**activeSub 的初始化和管理是 Vue 3 响应式系统的核心机制**：

1. **何时初始化**：在 `ReactiveEffect.run()` 或 `refreshComputed()` 执行时
2. **如何初始化**：设置为当前正在执行的订阅者实例
3. **为什么重要**：用于确定依赖收集的目标，建立响应式数据与订阅者的关联
4. **管理策略**：使用栈式管理支持嵌套场景，确保正确的恢复机制

这种设计确保了响应式系统能够准确地知道"谁在访问响应式数据"，从而建立正确的依赖关系，实现精确的响应式更新。
