# Vue 3 响应式系统简易实现原理 Demo

## 目录

1. [概述](#概述)
2. [核心概念](#核心概念)
3. [基础实现](#基础实现)
4. [依赖收集机制](#依赖收集机制)
5. [触发更新机制](#触发更新机制)
6. [性能优化策略](#性能优化策略)
7. [完整示例](#完整示例)
8. [与 Vue 3 源码对比](#与-vue-3-源码对比)

## 概述

Vue 3 的响应式系统是基于 **Proxy** 和 **依赖追踪** 的现代响应式实现。本文档通过简化的 Demo 代码，帮助理解其核心原理。

### 核心流程图

```mermaid
graph TB
    A[访问响应式对象] --> B[Proxy get 拦截]
    B --> C[依赖收集 track()]
    C --> D[存储当前 effect]

    E[修改响应式对象] --> F[Proxy set 拦截]
    F --> G[触发更新 trigger()]
    G --> H[执行相关 effects]

    I[批处理优化] --> J[避免重复执行]
    J --> K[异步更新队列]
```

## 核心概念

### 1. 响应式对象 (Reactive Object)

通过 Proxy 代理的对象，能够拦截属性的读取和设置操作。

### 2. 副作用函数 (Effect Function)

当响应式数据变化时需要重新执行的函数，如组件的渲染函数。

### 3. 依赖收集 (Dependency Collection)

在 effect 执行过程中，记录该 effect 依赖了哪些响应式数据。

### 4. 触发更新 (Trigger Update)

当响应式数据发生变化时，执行所有依赖该数据的 effect。

## 基础实现

### 1. 全局状态管理

```javascript
// 全局状态
let activeEffect = null // 当前正在执行的 effect
const targetMap = new WeakMap() // 存储所有依赖关系

// 依赖集合类
class Dep {
  constructor() {
    this.subscribers = new Set() // 存储订阅的 effects
  }

  // 添加依赖
  depend() {
    if (activeEffect) {
      this.subscribers.add(activeEffect)
    }
  }

  // 通知更新
  notify() {
    this.subscribers.forEach(effect => {
      if (effect !== activeEffect) {
        // 避免自己触发自己
        effect()
      }
    })
  }
}
```

### 2. 依赖收集函数

```javascript
// track: 收集依赖
function track(target, key) {
  if (!activeEffect) return

  // 获取 target 对应的依赖映射
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  // 获取 key 对应的依赖集合
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Dep()))
  }

  // 收集当前 effect
  dep.depend()
}
```

### 3. 触发更新函数

```javascript
// trigger: 触发更新
function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)
  if (dep) {
    dep.notify()
  }
}
```

### 4. 响应式对象创建

```javascript
// reactive: 创建响应式对象
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)

      // 依赖收集
      track(target, key)

      // 深度响应式
      if (typeof result === 'object' && result !== null) {
        return reactive(result)
      }

      return result
    },

    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)

      // 只有值真正改变时才触发更新
      if (oldValue !== value) {
        trigger(target, key)
      }

      return result
    },
  })
}
```

### 5. Effect 函数

```javascript
// effect: 创建副作用函数
function effect(fn) {
  const effectFn = () => {
    try {
      activeEffect = effectFn
      return fn() // 执行副作用函数，期间会触发依赖收集
    } finally {
      activeEffect = null
    }
  }

  effectFn() // 立即执行一次
  return effectFn
}
```

## 依赖收集机制

### 详细流程

```javascript
// 依赖收集的详细实现
function trackEffects(dep) {
  if (!activeEffect) return

  // 双向关联：effect 知道自己依赖了哪些 dep，dep 知道哪些 effect 依赖了自己
  dep.add(activeEffect)
  activeEffect.deps.push(dep)
}

// 改进的 Effect 类
class ReactiveEffect {
  constructor(fn) {
    this.fn = fn
    this.deps = [] // 记录该 effect 依赖的所有 dep
    this.active = true
  }

  run() {
    if (!this.active) return this.fn()

    try {
      activeEffect = this
      return this.fn()
    } finally {
      activeEffect = null
    }
  }

  stop() {
    if (this.active) {
      // 清理依赖
      this.deps.forEach(dep => dep.delete(this))
      this.deps.length = 0
      this.active = false
    }
  }
}
```

### 依赖收集示例

```javascript
// 示例：依赖收集过程
const obj = reactive({ name: 'Vue', version: 3 })

effect(() => {
  console.log(`${obj.name} ${obj.version}`) // 这里会触发依赖收集
})

// 执行过程：
// 1. effect 函数执行，设置 activeEffect
// 2. 访问 obj.name，触发 get 拦截器
// 3. 调用 track(obj, 'name')，收集依赖
// 4. 访问 obj.version，触发 get 拦截器
// 5. 调用 track(obj, 'version')，收集依赖
// 6. effect 执行完毕，清空 activeEffect
```

## 触发更新机制

### 基础触发机制

```javascript
// 触发更新的详细实现
function triggerEffects(dep) {
  // 创建副本避免无限循环
  const effects = Array.from(dep)

  effects.forEach(effect => {
    // 避免自己触发自己（例如在 effect 中修改了响应式数据）
    if (effect !== activeEffect) {
      if (effect.scheduler) {
        effect.scheduler() // 如果有调度器，使用调度器
      } else {
        effect.run() // 否则直接执行
      }
    }
  })
}
```

### 不同类型的触发

```javascript
// 增强的 trigger 函数，支持不同操作类型
const TriggerOpTypes = {
  SET: 'set',
  ADD: 'add',
  DELETE: 'delete',
  CLEAR: 'clear',
}

function trigger(target, type, key, newValue, oldValue) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps = []

  // 收集需要触发的依赖
  if (type === TriggerOpTypes.CLEAR) {
    // clear 操作影响所有属性
    deps = [...depsMap.values()]
  } else if (key === 'length' && Array.isArray(target)) {
    // 数组长度变化
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= newValue) {
        deps.push(dep)
      }
    })
  } else {
    // 普通属性变化
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }

    // 添加/删除属性需要触发迭代相关的依赖
    switch (type) {
      case TriggerOpTypes.ADD:
        if (Array.isArray(target) && isIntegerKey(key)) {
          deps.push(depsMap.get('length'))
        }
        break
    }
  }

  // 执行所有收集到的依赖
  deps.forEach(dep => {
    if (dep) {
      triggerEffects(dep)
    }
  })
}
```

## 性能优化策略

### 1. 批处理更新

```javascript
// 批处理队列
let isFlushing = false
let isFlushPending = false
const queue = []
const resolvedPromise = Promise.resolve()

function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlush()
  }
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    resolvedPromise.then(flushJobs)
  }
}

function flushJobs() {
  isFlushPending = false
  isFlushing = true

  // 排序确保父组件在子组件之前更新
  queue.sort((a, b) => a.id - b.id)

  try {
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i]
      if (job && job.active !== false) {
        job()
      }
    }
  } finally {
    queue.length = 0
    isFlushing = false
  }
}

// 带调度器的 effect
function effect(fn, options = {}) {
  const effectFn = new ReactiveEffect(fn)

  if (options.scheduler) {
    effectFn.scheduler = options.scheduler
  }

  effectFn.run()
  return effectFn
}
```

### 2. 避免重复收集

```javascript
// 优化的依赖收集，避免重复
function track(target, key) {
  if (!activeEffect || !shouldTrack) return

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  // 检查是否已经收集过
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}
```

### 3. 停止追踪优化

```javascript
// 控制追踪状态
let shouldTrack = true
const trackStack = []

function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}
```

## 完整示例

```javascript
// 完整的简易响应式系统实现
class MiniVueReactivity {
  constructor() {
    this.activeEffect = null
    this.targetMap = new WeakMap()
    this.shouldTrack = true
  }

  // 创建响应式对象
  reactive(target) {
    return new Proxy(target, {
      get: (target, key) => {
        this.track(target, key)
        const result = Reflect.get(target, key)

        if (typeof result === 'object' && result !== null) {
          return this.reactive(result)
        }
        return result
      },

      set: (target, key, value) => {
        const oldValue = target[key]
        const result = Reflect.set(target, key, value)

        if (oldValue !== value) {
          this.trigger(target, key)
        }
        return result
      },
    })
  }

  // 创建 ref 对象
  ref(value) {
    return {
      _value: value,
      get value() {
        this.track(this, 'value')
        return this._value
      },
      set value(newValue) {
        if (this._value !== newValue) {
          this._value = newValue
          this.trigger(this, 'value')
        }
      },
    }
  }

  // 依赖收集
  track(target, key) {
    if (!this.activeEffect || !this.shouldTrack) return

    let depsMap = this.targetMap.get(target)
    if (!depsMap) {
      this.targetMap.set(target, (depsMap = new Map()))
    }

    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Set()))
    }

    if (!dep.has(this.activeEffect)) {
      dep.add(this.activeEffect)
    }
  }

  // 触发更新
  trigger(target, key) {
    const depsMap = this.targetMap.get(target)
    if (!depsMap) return

    const dep = depsMap.get(key)
    if (!dep) return

    dep.forEach(effect => {
      if (effect !== this.activeEffect) {
        effect()
      }
    })
  }

  // 副作用函数
  effect(fn) {
    const effectFn = () => {
      try {
        this.activeEffect = effectFn
        return fn()
      } finally {
        this.activeEffect = null
      }
    }

    effectFn()
    return effectFn
  }
}

// 使用示例
const reactivity = new MiniVueReactivity()

// 创建响应式数据
const state = reactivity.reactive({
  count: 0,
  user: { name: 'Vue' },
})

const countRef = reactivity.ref(10)

// 创建副作用
reactivity.effect(() => {
  console.log('Count changed:', state.count)
})

reactivity.effect(() => {
  console.log('User name:', state.user.name)
})

reactivity.effect(() => {
  console.log('Ref value:', countRef.value)
})

// 测试更新
console.log('--- 开始测试 ---')
state.count = 1 // 触发第一个 effect
state.user.name = 'Vue 3' // 触发第二个 effect
countRef.value = 20 // 触发第三个 effect
```

## 与 Vue 3 源码对比

### 1. 相似之处

| 概念        | Demo 实现        | Vue 3 源码                                              |
| ----------- | ---------------- | ------------------------------------------------------- |
| 依赖收集    | `track()`        | `packages/reactivity/src/dep.ts` 中的 `track()`         |
| 触发更新    | `trigger()`      | `packages/reactivity/src/dep.ts` 中的 `trigger()`       |
| 响应式代理  | `Proxy` handlers | `packages/reactivity/src/baseHandlers.ts`               |
| Effect 管理 | `activeEffect`   | `packages/reactivity/src/effect.ts` 中的 `activeEffect` |

### 2. Vue 3 的额外优化

```typescript
// Vue 3 中的更多优化（简化展示）

// 1. 深度优化的依赖收集
function track(target: object, type: TrackOpTypes, key: unknown) {
  if (!isTracking()) return

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  trackEffects(dep, {
    target,
    type,
    key,
  })
}

// 2. 批处理和调度
class ReactiveEffect {
  constructor(fn, scheduler) {
    this.fn = fn
    this.scheduler = scheduler
    this.deps = []
    this.flags = EffectFlags.TRACKING | EffectFlags.ALLOW_RECURSE
  }

  trigger() {
    if (this.flags & EffectFlags.RUNNING) {
      if (this.flags & EffectFlags.ALLOW_RECURSE) {
        this.scheduler ? this.scheduler() : this.run()
      }
    }
  }
}

// 3. 性能标记和优化
const enum EffectFlags {
  ACTIVE = 1,
  RUNNING = 2,
  TRACKING = 4,
  NOTIFIED = 8,
  DIRTY = 16,
  ALLOW_RECURSE = 32,
}
```

### 3. 关键差异

1. **类型安全**: Vue 3 使用 TypeScript 提供完整的类型支持
2. **性能优化**: 更多的标记位和状态管理，避免不必要的计算
3. **边界情况处理**: 处理循环依赖、内存泄漏等问题
4. **调度系统**: 复杂的更新调度和批处理机制
5. **开发工具支持**: 提供详细的调试信息和开发者工具集成

### 4. 学习建议

1. **从简单开始**: 理解本 Demo 的基础原理
2. **逐步深入**: 阅读 Vue 3 源码中的对应实现
3. **实践验证**: 通过修改 Demo 代码验证理解
4. **性能分析**: 使用开发者工具观察真实的依赖收集过程

## 总结

Vue 3 的响应式系统通过以下核心机制实现高效的数据响应：

1. **Proxy 代理**: 拦截对象属性的读写操作
2. **依赖收集**: 在数据读取时记录依赖关系
3. **触发更新**: 在数据修改时执行相关副作用
4. **性能优化**: 通过批处理、缓存、标记等手段提升性能

通过理解这些基础原理，可以更好地使用 Vue 3 的响应式 API，并在必要时进行性能优化。
