# Vue 3 Ref useDirectValue 逻辑详解

## 核心代码分析 (ref.ts 139-143 行)

```typescript
const useDirectValue =
  this[ReactiveFlags.IS_SHALLOW] || // 条件 1: 当前是 shallowRef
  isShallow(newValue) || // 条件 2: 新值是 shallow 响应式对象
  isReadonly(newValue) // 条件 3: 新值是 readonly 对象

newValue = useDirectValue ? newValue : toRaw(newValue)
```

## 决策逻辑图

```
设置新值到 ref
        ↓
   检查三个条件
        ↓
┌─────────────────────────────────────┐
│  useDirectValue = (任一条件为 true)  │
│                                     │
│  1. this[IS_SHALLOW] = true?        │
│     (当前是 shallowRef)             │
│                                     │
│  2. isShallow(newValue) = true?     │
│     (新值是 shallow 响应式)         │
│                                     │
│  3. isReadonly(newValue) = true?    │
│     (新值是 readonly)               │
└─────────────────────────────────────┘
        ↓
    判断结果
        ↓
┌─────────────────┬─────────────────────┐
│ useDirectValue  │ useDirectValue      │
│ = true          │ = false             │
│                 │                     │
│ 直接使用新值     │ 使用 toRaw(newValue) │
│ newValue        │ 提取原始值           │
└─────────────────┴─────────────────────┘
```

## 具体场景示例

### 场景 1: 普通 ref + 普通对象

```javascript
const normalRef = ref({ name: 'Alice' })
const plainObj = { name: 'Bob' }

// 条件检查:
// ✗ this[IS_SHALLOW] = false (普通 ref)
// ✗ isShallow(plainObj) = false (普通对象)
// ✗ isReadonly(plainObj) = false (可写)
// → useDirectValue = false
// → 执行: newValue = toRaw(plainObj) (无变化，因为本就是原始对象)

normalRef.value = plainObj // 最终存储并转为响应式
```

### 场景 2: shallowRef + 任何对象

```javascript
const shallowRef = shallowRef({ count: 0 })
const anyObj = { count: 1 }

// 条件检查:
// ✓ this[IS_SHALLOW] = true (shallowRef)
// → useDirectValue = true (短路，不再检查其他条件)
// → 执行: newValue = anyObj (直接使用)

shallowRef.value = anyObj // 直接存储，不转为响应式
```

### 场景 3: 普通 ref + shallow 响应式对象

```javascript
const normalRef = ref({ x: 1 })
const shallowObj = shallowReactive({ x: 2 })

// 条件检查:
// ✗ this[IS_SHALLOW] = false (普通 ref)
// ✓ isShallow(shallowObj) = true (shallow 对象)
// → useDirectValue = true
// → 执行: newValue = shallowObj (直接使用)

normalRef.value = shallowObj // 保持 shallow 特性
```

### 场景 4: 普通 ref + readonly 对象

```javascript
const normalRef = ref({ y: 1 })
const readonlyObj = readonly({ y: 2 })

// 条件检查:
// ✗ this[IS_SHALLOW] = false (普通 ref)
// ✗ isShallow(readonlyObj) = false
// ✓ isReadonly(readonlyObj) = true (readonly)
// → useDirectValue = true
// → 执行: newValue = readonlyObj (直接使用)

normalRef.value = readonlyObj // 保持 readonly 特性
```

### 场景 5: 普通 ref + reactive 对象

```javascript
const normalRef = ref({ z: 1 })
const reactiveObj = reactive({ z: 2 })

// 条件检查:
// ✗ this[IS_SHALLOW] = false (普通 ref)
// ✗ isShallow(reactiveObj) = false (深响应式)
// ✗ isReadonly(reactiveObj) = false (可写)
// → useDirectValue = false
// → 执行: newValue = toRaw(reactiveObj) (提取原始对象)

normalRef.value = reactiveObj // 存储原始值，然后重新包装为响应式
```

## 设计意图

1. **避免嵌套代理**: 防止 proxy wrapping proxy 的情况
2. **保持特性**: 维护 shallow 和 readonly 的特殊行为
3. **性能优化**: 对 shallowRef 避免不必要的深度响应式转换
4. **类型安全**: 确保不同响应式类型的正确处理

## 后续处理

在 `useDirectValue` 逻辑之后，还有关键的存储逻辑：

```typescript
if (hasChanged(newValue, oldValue)) {
  this._rawValue = newValue // 存储处理后的原始值
  this._value = useDirectValue ? newValue : toReactive(newValue) // 决定最终值
  // 触发更新...
}
```

- `_rawValue`: 存储原始值（用于比较）
- `_value`: 存储最终值（可能是响应式包装）
