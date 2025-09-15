# Vue 3 Dep 类分析文档

## 概述

`Dep` 类是 Vue 3 响应式系统的核心组件之一，位于 `packages/reactivity/src/dep.ts` 文件中。它负责管理响应式对象的依赖关系，跟踪哪些 effect（副作用）依赖于特定的响应式属性，并在属性变化时通知这些 effect 进行更新。

## 类定义

```typescript
export class Dep {
  version = 0
  activeLink?: Link = undefined
  subs?: Link = undefined
  subsHead?: Link
  map?: KeyToDepMap = undefined
  key?: unknown = undefined
  sc: number = 0
  readonly __v_skip = true

  constructor(public computed?: ComputedRefImpl | undefined) {
    if (__DEV__) {
      this.subsHead = undefined
    }
  }
}
```

## 属性详解

### 1. `version: number`

- **作用**: 版本号，每次响应式数据变化时递增
- **用途**: 为计算属性提供快速路径，避免在没有变化时重新计算
- **初始值**: 0

### 2. `activeLink?: Link`

- **作用**: 当前活跃 effect 与此 dep 之间的链接
- **类型**: `Link | undefined`
- **用途**: 缓存当前正在追踪的 effect 链接，避免重复创建

### 3. `subs?: Link`

- **作用**: 订阅此 dep 的 effect 双向链表的尾部节点
- **类型**: `Link | undefined`
- **用途**: 管理所有依赖此响应式属性的 effect

### 4. `subsHead?: Link`

- **作用**: 订阅此 dep 的 effect 双向链表的头部节点
- **类型**: `Link | undefined`
- **用途**: 仅在开发环境中使用，用于按正确顺序调用 onTrigger 钩子

### 5. `map?: KeyToDepMap`

- **作用**: 指向包含此 dep 的 KeyToDepMap
- **类型**: `Map<any, Dep> | undefined`
- **用途**: 用于对象属性的 dep 清理

### 6. `key?: unknown`

- **作用**: 此 dep 对应的属性键
- **类型**: `unknown`
- **用途**: 标识具体的响应式属性

### 7. `sc: number`

- **作用**: 订阅者计数器
- **类型**: `number`
- **初始值**: 0
- **用途**: 跟踪有多少个 effect 订阅了此 dep

### 8. `__v_skip: boolean`

- **作用**: 响应式跳过标记
- **类型**: `boolean`
- **值**: `true`
- **用途**: 标记此对象不应被响应式系统处理

### 9. `computed?: ComputedRefImpl`

- **作用**: 关联的计算属性实例
- **类型**: `ComputedRefImpl | undefined`
- **用途**: 如果此 dep 属于计算属性，则引用计算属性实例

## 核心方法

### 1. `track(debugInfo?: DebuggerEventExtraInfo): Link | undefined`

**作用**: 跟踪对响应式属性的访问

**逻辑流程**:

1. 检查是否有活跃的 effect 且应该进行跟踪
2. 查找或创建当前 effect 与此 dep 的链接
3. 如果是新链接，添加到 effect 的依赖列表
4. 如果是重用的链接，同步版本号并调整链表顺序
5. 在开发环境中调用 onTrack 钩子

**返回值**: 创建或重用的 `Link` 实例

### 2. `trigger(debugInfo?: DebuggerEventExtraInfo): void`

**作用**: 触发依赖更新

**逻辑流程**:

1. 递增版本号和全局版本号
2. 调用 `notify` 方法通知所有订阅者

### 3. `notify(debugInfo?: DebuggerEventExtraInfo): void`

**作用**: 通知所有订阅此 dep 的 effect

**逻辑流程**:

1. 开始批处理 (`startBatch`)
2. 在开发环境中，按原始顺序调用 onTrigger 钩子
3. 反向遍历订阅者链表，调用每个 effect 的 `notify` 方法
4. 如果订阅者是计算属性，递归通知其依赖
5. 结束批处理 (`endBatch`)

## 相关辅助函数

### `addSub(link: Link)`

- **作用**: 将新的订阅者添加到 dep 的订阅者列表
- **逻辑**:
  - 递增订阅者计数
  - 处理计算属性的特殊逻辑
  - 维护双向链表结构

### 全局函数

#### `track(target: object, type: TrackOpTypes, key: unknown): void`

- **作用**: 跟踪对响应式对象属性的访问
- **参数**:
  - `target`: 响应式对象
  - `type`: 访问类型
  - `key`: 属性键
- **逻辑**: 从 targetMap 获取或创建对应的 dep，然后调用其 track 方法

#### `trigger(target: object, type: TriggerOpTypes, key?, newValue?, oldValue?, oldTarget?): void`

- **作用**: 触发响应式对象属性变化的副作用
- **参数**:
  - `target`: 响应式对象
  - `type`: 触发类型（SET、ADD、DELETE、CLEAR）
  - `key`: 属性键（可选）
  - `newValue`: 新值（可选）
  - `oldValue`: 旧值（可选）
  - `oldTarget`: 旧目标（可选）

## 数据结构关系

```
targetMap (WeakMap)
  └── target (object)
      └── depsMap (Map)
          └── key (any)
              └── dep (Dep)
                  ├── subs (Link) ──→ Link ──→ Link ──→ ...
                  └── subsHead (Link)
```

## 特殊符号常量

- `ITERATE_KEY`: 用于对象迭代的特殊键
- `MAP_KEY_ITERATE_KEY`: 用于 Map 键迭代的特殊键
- `ARRAY_ITERATE_KEY`: 用于数组迭代的特殊键

## 触发类型处理

### TriggerOpTypes.CLEAR

- 清空集合时触发所有 dep

### TriggerOpTypes.ADD

- 对象: 触发 ITERATE_KEY 和 MAP_KEY_ITERATE_KEY
- 数组: 新增索引时触发 length 变化

### TriggerOpTypes.DELETE

- 对象: 触发 ITERATE_KEY 和 MAP_KEY_ITERATE_KEY
- 数组: 不特殊处理

### TriggerOpTypes.SET

- Map: 触发 ITERATE_KEY
- 数组长度变化: 触发所有大于等于新长度的索引

## 性能优化特性

1. **版本控制**: 通过 version 字段避免不必要的重新计算
2. **链表复用**: 重用现有的 Link 对象而不是重新创建
3. **批处理**: 使用 startBatch/endBatch 优化多次更新
4. **惰性订阅**: 计算属性仅在有订阅者时才启用跟踪

## 开发环境特性

- **调试信息**: 支持 onTrack 和 onTrigger 钩子
- **双向链表头**: subsHead 用于正确顺序的钩子调用
- **详细的触发信息**: 包含 target、type、key、newValue、oldValue 等

## 总结

`Dep` 类是 Vue 3 响应式系统的核心，它通过精心设计的双向链表结构和版本控制机制，高效地管理响应式数据的依赖关系。其设计充分考虑了性能优化、内存管理和开发调试的需求，是 Vue 3 能够提供高性能响应式体验的关键组件之一。
