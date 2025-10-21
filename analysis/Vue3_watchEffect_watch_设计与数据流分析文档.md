# Vue 3 watchEffect 和 watch 设计与数据流分析

## 1. 概述

Vue 3 的响应式系统提供了两种主要的监听机制：`watchEffect` 和 `watch`。它们都基于响应式系统的底层机制，但在使用方式和设计目标上有所不同：

- `watchEffect`：自动追踪其回调函数中的响应式依赖，当依赖发生变化时重新执行
- `watch`：显式指定监听源，当源发生变化时执行回调函数

## 2. 核心设计原理

### 2.1 响应式系统基础

Vue 3 的响应式系统基于以下核心概念：

1. **ReactiveEffect（副作用）**：包装需要响应式执行的函数
2. **Dep（依赖）**：表示响应式数据源，负责收集和通知订阅者
3. **Link（链接）**：连接 Dep 和 Subscriber 的桥梁
4. **Scheduler（调度器）**：控制副作用的执行时机和顺序

### 2.2 依赖收集机制

```javascript
// 依赖收集的三重检查
if (
  !activeSub || // 当前是否有活跃的订阅者
  !shouldTrack || // 全局依赖跟踪开关是否开启
  activeSub === this.computed // 避免computed对自身的循环依赖
) {
  return
}
```

## 3. watchEffect 设计与实现

### 3.1 基本用法

```javascript
const count = ref(0)

watchEffect(() => {
  console.log(count.value)
})

count.value++ // 触发 watchEffect 重新执行
```

### 3.2 实现原理

1. `watchEffect` 调用 `doWatch` 函数，传入 effect 函数和 null 作为回调
2. 在 `doWatch` 中创建 `ReactiveEffect` 实例
3. effect 函数在执行时会自动收集其内部访问的响应式数据依赖
4. 当依赖发生变化时，触发 effect 重新执行

### 3.3 数据流

```
watchEffect(effectFn)
  → doWatch(effectFn, null, options)
    → 创建 ReactiveEffect(effectFn)
      → effect.run()
        → 设置 activeSub = effect
        → 执行 effectFn（自动收集依赖）
        → 清理 activeSub
```

## 4. watch 设计与实现

### 4.1 基本用法

```javascript
const count = ref(0)

watch(count, (newValue, oldValue) => {
  console.log(`count changed from ${oldValue} to ${newValue}`)
})

count.value++ // 触发 watch 回调执行
```

### 4.2 实现原理

1. `watch` 调用 `doWatch` 函数，传入监听源、回调函数和选项
2. 根据监听源类型创建相应的 getter 函数
3. 创建 `ReactiveEffect` 实例包装 getter 函数
4. 当监听源发生变化时，触发回调函数执行

### 4.3 数据流

```
watch(source, callback, options)
  → doWatch(source, callback, options)
    → 根据 source 类型创建 getter
    → 创建 ReactiveEffect(getter)
    → effect.run() 获取初始值
    → 依赖变化时触发 job 函数
      → 执行 getter 获取新值
      → 比较新旧值
      → 调用 callback(newValue, oldValue)
```

## 5. 调度机制

### 5.1 flush 选项

Vue 3 提供了三种 flush 选项控制执行时机：

- `pre`（默认）：组件更新前执行
- `post`：组件更新后执行
- `sync`：同步执行

### 5.2 调度器实现

```javascript
// pre 模式调度器
baseWatchOptions.scheduler = (job, isFirstRun) => {
  if (isFirstRun) {
    job()
  } else {
    queueJob(job)
  }
}

// post 模式调度器
baseWatchOptions.scheduler = job => {
  queuePostRenderEffect(job, instance && instance.suspense)
}
```

## 6. 批处理优化

Vue 3 使用批处理机制优化多次响应式更新：

1. 依赖变化时，将副作用加入批处理队列
2. 在下一个微任务中统一执行队列中的副作用
3. 避免同一副作用在同一批次中重复执行

```javascript
export function batch(sub: Subscriber, isComputed = false): void {
  sub.flags |= EffectFlags.NOTIFIED
  // ...
}
```

## 7. 清理机制

### 7.1 副作用清理

```javascript
function cleanupEffect(effect: ReactiveEffect) {
  const { cleanup } = effect
  effect.cleanup = undefined
  if (cleanup) {
    cleanup()
  }
}
```

### 7.2 依赖清理

```javascript
function cleanupDeps(sub: Subscriber) {
  let link = sub.deps
  while (link) {
    const { dep, prevSub, nextSub } = link
    if (link.version === -1) {
      // 清理未使用的依赖
      if (prevSub) prevSub.nextSub = nextSub
      if (nextSub) nextSub.prevSub = prevSub
      // ...
    }
    link = link.nextDep
  }
}
```

## 8. 特殊功能实现

### 8.1 immediate 选项

```javascript
if (cb) {
  if (immediate) {
    job(true) // 立即执行
  } else {
    oldValue = effect.run() // 获取初始值
  }
}
```

### 8.2 deep 选项

```javascript
if (cb && deep) {
  const baseGetter = getter
  const depth = deep === true ? Infinity : deep
  getter = () => traverse(baseGetter(), depth)
}
```

### 8.3 once 选项

```javascript
if (once && cb) {
  const _cb = cb
  cb = (...args) => {
    _cb(...args)
    watchHandle() // 执行后自动停止
  }
}
```

## 9. 性能优化

### 9.1 位标志优化

使用位运算管理副作用状态：

```javascript
export enum EffectFlags {
  ACTIVE = 1 << 0,     // 副作用是否活跃
  RUNNING = 1 << 1,    // 副作用是否正在运行
  TRACKING = 1 << 2,   // 是否正在收集依赖
  NOTIFIED = 1 << 3,   // 是否已被通知
  DIRTY = 1 << 4,      // 是否需要重新计算
  ALLOW_RECURSE = 1 << 5, // 是否允许递归
  PAUSED = 1 << 6,     // 是否已暂停
  EVALUATED = 1 << 7,  // 是否已求值
}
```

### 9.2 LRU 依赖管理

将最近使用的依赖移到链表尾部，实现 LRU 策略：

```javascript
// 将Link移动到链表尾部（LRU策略）
if (link.nextDep) {
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
}
```

## 10. 调试支持

提供 `onTrack` 和 `onTrigger` 钩子用于调试：

```javascript
watch(source, callback, {
  onTrack(e) {
    console.log('追踪依赖:', e)
  },
  onTrigger(e) {
    console.log('触发更新:', e)
  },
})
```

## 11. 总结

Vue 3 的 watch 和 watchEffect 机制通过以下设计实现了高效、灵活的响应式监听：

1. **统一的底层机制**：都基于 ReactiveEffect 和 Dep 系统
2. **灵活的 API 设计**：watchEffect 自动追踪，watch 显式指定
3. **丰富的选项配置**：immediate、deep、flush、once 等
4. **高性能优化**：批处理、位标志、LRU 缓存等
5. **完善的调试支持**：onTrack、onTrigger 钩子
6. **良好的类型支持**：TypeScript 条件类型确保类型安全

这种设计既保证了功能的完整性，又兼顾了性能和开发体验。
