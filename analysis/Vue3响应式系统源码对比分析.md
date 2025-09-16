# Vue 3 响应式系统源码对比分析

## 目录

1. [Demo vs Vue 3 源码对比](#demo-vs-vue-3-源码对比)
2. [性能优化细节分析](#性能优化细节分析)
3. [依赖收集深度分析](#依赖收集深度分析)
4. [触发更新机制对比](#触发更新机制对比)
5. [关键源码位置索引](#关键源码位置索引)

## Demo vs Vue 3 源码对比

### 1. 依赖收集对比

#### Demo 实现

```javascript
// analysis/reactivity-demo.js
track(target, key) {
  if (!this.activeEffect || !this.shouldTrack) return

  let depsMap = this.targetMap.get(target)
  if (!depsMap) {
    this.targetMap.set(target, depsMap = new Map())
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, dep = new Set())
  }

  if (!dep.has(this.activeEffect)) {
    dep.add(this.activeEffect)
    this.activeEffect.deps.push(dep)
  }
}
```

#### Vue 3 源码实现

```typescript
// packages/reactivity/src/dep.ts
export function track(target: object, type: TrackOpTypes, key: unknown): void {
  if (!isTracking()) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep(() => depsMap!.delete(key))))
  }
  trackEffect(
    activeEffect!,
    dep,
    __DEV__
      ? {
          target,
          type,
          key,
        }
      : void 0,
  )
}
```

**关键差异：**

1. Vue 3 使用 `createDep()` 创建智能依赖对象
2. 提供详细的调试信息（开发模式）
3. 更完善的类型检查和边界处理

### 2. 触发更新对比

#### Demo 实现

```javascript
trigger(target, key, newValue, oldValue) {
  const depsMap = this.targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)
  if (dep) {
    dep.forEach(effect => {
      if (effect !== this.activeEffect) {
        effect.scheduler ? effect.scheduler() : this.runEffect(effect)
      }
    })
  }
}
```

#### Vue 3 源码实现

```typescript
// packages/reactivity/src/dep.ts
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>,
): void {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    globalVersion++
    return
  }

  const run = (dep: Dep | undefined) => {
    if (dep) {
      if (__DEV__) {
        dep.trigger({
          target,
          type,
          key,
          newValue,
          oldValue,
          oldTarget,
        })
      } else {
        dep.trigger()
      }
    }
  }

  startBatch()
  // ... 复杂的触发逻辑
  endBatch()
}
```

**关键差异：**

1. Vue 3 有完整的批处理机制 (`startBatch/endBatch`)
2. 支持多种触发类型 (`SET`, `ADD`, `DELETE`, `CLEAR`)
3. 处理数组、Map、Set 等特殊情况
4. 全局版本号管理 (`globalVersion++`)

## 性能优化细节分析

### 1. 批处理优化

#### Vue 3 的批处理实现

```typescript
// packages/reactivity/src/dep.ts
let batchDepth = 0
let batchedDeps: Dep[] | undefined

export function startBatch(): void {
  batchDepth++
}

export function endBatch(): void {
  batchDepth--
  if (batchDepth > 0) {
    return
  }
  if (batchedDeps) {
    let i = 0
    for (; i < batchedDeps.length; i++) {
      const dep = batchedDeps[i]
      dep.trigger()
    }
    batchedDeps.length = 0
  }
}
```

**优化原理：**

- 在同一个同步任务中的多次更新会被批量处理
- 避免了重复执行相同的副作用函数
- 减少了不必要的DOM更新

### 2. Effect 标记优化

#### Vue 3 的 Effect 标记系统

```typescript
// packages/reactivity/src/effect.ts
export enum EffectFlags {
  ACTIVE = 1,
  RUNNING = 2,
  TRACKING = 4,
  NOTIFIED = 8,
  DIRTY = 16,
  ALLOW_RECURSE = 32,
  PAUSED = 64,
}

export class ReactiveEffect<T = any> {
  flags = EffectFlags.ACTIVE | EffectFlags.TRACKING

  trigger(): void {
    if (this.flags & EffectFlags.RUNNING) {
      if (!(this.flags & EffectFlags.ALLOW_RECURSE)) {
        return
      }
    }
    if (!(this.flags & EffectFlags.NOTIFIED)) {
      this.flags |= EffectFlags.NOTIFIED
      this.nextEffect = batchedEffect
      batchedEffect = this
    }
  }
}
```

**优化点：**

1. **NOTIFIED**: 防止在同一批次中重复通知
2. **RUNNING**: 防止递归执行
3. **ALLOW_RECURSE**: 允许特定情况下的递归
4. **PAUSED**: 暂停状态管理

### 3. 依赖清理优化

#### Vue 3 的依赖清理策略

```typescript
// packages/reactivity/src/effect.ts
function cleanupDepEffect(dep: Dep, effect: ReactiveEffect) {
  const trackId = dep.get(effect)
  if (trackId !== undefined && effect.trackId !== trackId) {
    dep.delete(effect)
    if (dep.size === 0) {
      dep.cleanup()
    }
  }
}
```

**清理时机：**

- Effect 重新执行前清理旧依赖
- 依赖集合为空时自动清理
- 组件卸载时清理所有相关依赖

## 依赖收集深度分析

### 1. TrackOpTypes 分类

```typescript
// packages/reactivity/src/constants.ts
export enum TrackOpTypes {
  GET = 'get',
  HAS = 'has',
  ITERATE = 'iterate',
}
```

不同操作类型的依赖收集：

#### GET 操作

```typescript
// packages/reactivity/src/baseHandlers.ts - get trap
get(target: Target, key: string | symbol, receiver: object): any {
  // ... 其他逻辑
  if (!isReadonly) {
    track(target, TrackOpTypes.GET, key)
  }
  // ...
}
```

#### HAS 操作

```typescript
// packages/reactivity/src/baseHandlers.ts - has trap
has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key)
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key)
  }
  return result
}
```

#### ITERATE 操作

```typescript
// packages/reactivity/src/baseHandlers.ts - ownKeys trap
ownKeys(target: object): (string | symbol)[] {
  track(
    target,
    TrackOpTypes.ITERATE,
    isArray(target) ? 'length' : ITERATE_KEY,
  )
  return Reflect.ownKeys(target)
}
```

### 2. 特殊场景的依赖收集

#### 数组操作优化

```typescript
// packages/reactivity/src/arrayInstrumentations.ts
export function reactiveReadArray<T>(array: T[]): T[] {
  const raw = toRaw(array)
  if (raw === array) return raw
  track(raw, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY)
  return isShallow(array) ? raw : raw.map(toReactive)
}
```

#### Map/Set 操作优化

```typescript
// packages/reactivity/src/collectionHandlers.ts
function createIterableMethod(
  method: string | symbol,
  isReadonly: boolean,
  isShallow: boolean,
) {
  return function (this: IterableCollections, ...args: unknown[]) {
    const target = this[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const targetIsMap = isMap(rawTarget)

    if (!isReadonly) {
      track(
        rawTarget,
        TrackOpTypes.ITERATE,
        targetIsMap ? MAP_KEY_ITERATE_KEY : ITERATE_KEY,
      )
    }
    // ...
  }
}
```

## 触发更新机制对比

### 1. TriggerOpTypes 分类

```typescript
// packages/reactivity/src/constants.ts
export enum TriggerOpTypes {
  SET = 'set',
  ADD = 'add',
  DELETE = 'delete',
  CLEAR = 'clear',
}
```

### 2. 不同操作的触发策略

#### SET 操作

```javascript
// 普通属性设置
if (key !== void 0) {
  run(depsMap.get(key))
}
```

#### ADD 操作

```javascript
// 添加新属性需要触发迭代相关依赖
if (!targetIsArray) {
  run(depsMap.get(ITERATE_KEY))
  if (isMap(target)) {
    run(depsMap.get(MAP_KEY_ITERATE_KEY))
  }
} else if (isArrayIndex) {
  // 数组添加元素影响 length
  run(depsMap.get('length'))
}
```

#### DELETE 操作

```javascript
// 删除属性同样影响迭代
if (!targetIsArray) {
  run(depsMap.get(ITERATE_KEY))
  if (isMap(target)) {
    run(depsMap.get(MAP_KEY_ITERATE_KEY))
  }
}
```

### 3. 数组特殊处理

#### 长度变化处理

```typescript
if (targetIsArray && key === 'length') {
  const newLength = Number(newValue)
  depsMap.forEach((dep, key) => {
    if (
      key === 'length' ||
      key === ARRAY_ITERATE_KEY ||
      (!isSymbol(key) && key >= newLength)
    ) {
      run(dep)
    }
  })
}
```

**处理逻辑：**

1. 数组长度变化影响所有索引 >= newLength 的依赖
2. 同时触发 `length` 和 `ARRAY_ITERATE_KEY` 的依赖
3. 优化了数组操作的性能

## 关键源码位置索引

### 核心文件结构

```
packages/reactivity/src/
├── constants.ts          # 常量定义 (TrackOpTypes, TriggerOpTypes)
├── dep.ts               # 依赖管理核心 (track, trigger)
├── effect.ts            # Effect 系统
├── reactive.ts          # reactive API
├── ref.ts              # ref API
├── baseHandlers.ts     # 对象代理处理器
├── collectionHandlers.ts # 集合类型处理器
└── arrayInstrumentations.ts # 数组方法增强
```

### 关键函数映射

| 功能        | Demo 位置        | Vue 3 源码位置                                 |
| ----------- | ---------------- | ---------------------------------------------- |
| 依赖收集    | `track()`        | `packages/reactivity/src/dep.ts#track`         |
| 触发更新    | `trigger()`      | `packages/reactivity/src/dep.ts#trigger`       |
| 创建响应式  | `reactive()`     | `packages/reactivity/src/reactive.ts#reactive` |
| 创建 ref    | `ref()`          | `packages/reactivity/src/ref.ts#ref`           |
| Effect 系统 | `effect()`       | `packages/reactivity/src/effect.ts#effect`     |
| 对象代理    | `Proxy handlers` | `packages/reactivity/src/baseHandlers.ts`      |

### 学习路径建议

1. **从 Demo 开始**：理解基础概念和流程
2. **阅读 constants.ts**：了解类型定义
3. **深入 dep.ts**：核心依赖管理逻辑
4. **研究 baseHandlers.ts**：对象代理实现
5. **探索 effect.ts**：Effect 系统优化
6. **分析特殊处理**：数组、集合等特殊情况

### 调试技巧

#### 1. 在浏览器中调试

```javascript
// 在控制台中设置断点
const obj = reactive({ name: 'test' })
debugger // 在这里设置断点
effect(() => console.log(obj.name))
```

#### 2. 查看依赖关系

```javascript
// 查看对象的依赖映射
console.log(targetMap.get(obj))

// 查看特定属性的依赖
console.log(targetMap.get(obj)?.get('name'))
```

#### 3. 监控 Effect 执行

```javascript
// 在 Vue 3 源码中添加调试代码
function track(target, type, key) {
  console.log('Track:', { target, type, key, activeEffect })
  // ... 原有逻辑
}

function trigger(target, type, key) {
  console.log('Trigger:', { target, type, key })
  // ... 原有逻辑
}
```

## 总结

通过 Demo 和源码的对比分析，可以看出：

1. **Demo 实现**：简化了核心流程，便于理解基本原理
2. **Vue 3 源码**：考虑了更多边界情况和性能优化
3. **关键差异**：批处理、类型支持、错误处理、性能标记等
4. **学习建议**：先理解 Demo，再深入源码，最后实践调试

Vue 3 的响应式系统是一个精心设计的系统，既保证了功能的完整性，又优化了性能表现。通过理解其实现原理，可以更好地使用 Vue 3 的响应式 API，并在必要时进行性能调优。
