# Vue 3 响应式系统中为什么使用 Map 而不是 WeakMap 的技术分析

## 概述

在 Vue 3 的响应式系统中，依赖收集采用了两层映射结构的设计。本文档将详细分析为什么在第二层映射中使用 `Map` 而不是 `WeakMap` 的技术原因。

## 背景信息

### 相关代码位置

- **文件路径**: `packages/reactivity/src/dep.ts`
- **关键代码行**: 第 275 行
- **函数**: `track` 函数

### 代码片段

```typescript
export function track(target: object, type: TrackOpTypes, key: unknown): void {
  if (shouldTrack && activeSub) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map())) // 第 275 行
    }
    // ... 其他代码
  }
}
```

## 系统架构分析

### 两层映射结构设计

Vue 3 的响应式系统采用了精心设计的两层映射结构：

```typescript
// 第一层：target -> KeyToDepMap (使用 WeakMap)
export const targetMap: WeakMap<object, KeyToDepMap> = new WeakMap()

// 第二层：key -> Dep (使用 Map)
type KeyToDepMap = Map<any, Dep>
```

### 数据流图示

```
响应式对象 (target)
    ↓
targetMap (WeakMap)
    ↓
depsMap (Map) ← 第 275 行创建的 Map
    ↓
Dep 实例
```

## 技术原因分析

### 1. 键类型限制

**WeakMap 的限制**：

- WeakMap 的键只能是对象类型
- 不支持原始类型（字符串、数字、Symbol 等）

**实际需求**：
在响应式系统中，属性的键可能是多种类型：

```typescript
// 字符串键
obj.name = 'Vue' // key: 'name'
obj.age = 3 // key: 'age'

// 数字键（数组索引）
arr[0] = 'first' // key: 0
arr[1] = 'second' // key: 1

// Symbol 键（特殊标识）
ITERATE_KEY // Symbol('Object iterate')
MAP_KEY_ITERATE_KEY // Symbol('Map keys iterate')
ARRAY_ITERATE_KEY // Symbol('Array iterate')

// undefined 键（特殊情况）
void 0 // undefined
```

### 2. 遍历功能需求

**触发器函数中的遍历需求**：

```typescript
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
): void {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  // 场景1：清空集合时需要触发所有依赖
  if (type === TriggerOpTypes.CLEAR) {
    depsMap.forEach(run) // WeakMap 不支持 forEach
  }

  // 场景2：数组长度变化时需要遍历特定依赖
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
}
```

**WeakMap 的限制**：

- 不支持 `forEach()` 方法
- 不支持 `keys()`、`values()`、`entries()` 方法
- 无法进行遍历操作

### 3. 调试和内省支持

**开发模式下的需求**：

```typescript
// 测试用例中需要检查依赖是否正确建立
test('should release property Dep instance if it no longer has subscribers', () => {
  let obj = { x: 1 }
  let a = reactive(obj)
  const e = effect(() => a.x)

  // 需要能够访问内部依赖结构进行断言
  expect(targetMap.get(obj)?.get('x')).toBeTruthy()

  e.effect.stop()
  expect(targetMap.get(obj)?.get('x')).toBeFalsy()
})
```

**WeakMap 的限制**：

- 不支持内省操作
- 无法在开发工具中查看内容
- 难以进行调试和测试

### 4. 内存管理策略

**设计原则**：

- **外层 WeakMap**：管理对象级别的内存回收
- **内层 Map**：提供完整的属性访问功能

**内存管理流程**：

```typescript
// 当响应式对象被垃圾回收时
reactiveObject = null // 对象失去引用

// targetMap (WeakMap) 会自动清理对应的条目
// 连同内部的 depsMap (Map) 一起被回收
// 实现了自动的内存管理
```

## 性能影响分析

### 操作复杂度对比

| 操作     | Map  | WeakMap |
| -------- | ---- | ------- |
| 设置     | O(1) | O(1)    |
| 获取     | O(1) | O(1)    |
| 删除     | O(1) | O(1)    |
| 遍历     | O(n) | 不支持  |
| 内存回收 | 手动 | 自动    |

### 内存使用对比

**Map 的特点**：

- 保持强引用
- 需要手动清理（通过外层 WeakMap 实现）
- 支持所有类型的键

**WeakMap 的特点**：

- 弱引用，自动垃圾回收
- 只支持对象键
- 不可遍历

## 设计权衡

### 为什么不全部使用 WeakMap？

1. **功能限制**：WeakMap 无法满足响应式系统的核心需求
2. **类型限制**：无法处理非对象类型的属性键
3. **操作限制**：无法进行必要的遍历操作

### 为什么不全部使用 Map？

1. **内存泄漏风险**：可能导致响应式对象无法被垃圾回收
2. **性能影响**：需要手动管理大量对象的生命周期

### 混合方案的优势

```typescript
// 完美的设计平衡
targetMap: WeakMap<object, KeyToDepMap>  // 自动内存管理
         ↓
KeyToDepMap: Map<any, Dep>              // 功能完整性
```

**优势总结**：

1. **内存安全**：外层 WeakMap 确保无内存泄漏
2. **功能完整**：内层 Map 支持所有必要操作
3. **性能优化**：合理的操作复杂度
4. **开发体验**：支持调试和测试

## 实际应用场景

### 场景1：对象属性变化

```typescript
const obj = reactive({ name: 'Vue', age: 3 })
obj.name = 'Vue 3' // 触发 'name' 属性的依赖
```

### 场景2：数组操作

```typescript
const arr = reactive([1, 2, 3])
arr.push(4) // 触发数组长度和索引相关的依赖
```

### 场景3：Map/Set 操作

```typescript
const map = reactive(new Map())
map.clear() // 需要遍历所有依赖进行触发
```

## 总结

Vue 3 在第 275 行使用 `Map` 而不是 `WeakMap` 是一个经过深思熟虑的设计决策，主要原因包括：

1. **键类型兼容性**：支持字符串、数字、Symbol 等多种类型的属性键
2. **遍历操作需求**：响应式更新机制需要遍历依赖集合
3. **调试支持**：开发模式下需要内省和测试能力
4. **架构平衡**：与外层 WeakMap 形成完美的内存管理和功能平衡

这种设计体现了 Vue 3 在性能、功能性和开发体验之间的精确平衡，是响应式系统架构的重要组成部分。

## 相关资源

- [Vue 3 响应式系统源码](packages/reactivity/src/dep.ts)
- [MDN WeakMap 文档](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
- [MDN Map 文档](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)

---

_文档版本：1.0_  
_创建时间：2025-09-18_  
_Vue 3 版本：3.x_
