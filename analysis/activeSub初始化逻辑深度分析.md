# activeSub 初始化逻辑深度分析

## 1. activeSub 的声明与初始状态

```typescript
// packages/reactivity/src/effect.ts:39
export let activeSub: Subscriber | undefined
```

**初始状态**: `activeSub` 在模块加载时被声明为 `undefined`，这是它的**默认初始状态**。

## 2. activeSub 的首次初始化位置

### 2.1 ReactiveEffect.run() 方法中的初始化

**最主要的初始化逻辑**位于 [`ReactiveEffect.run()`](c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L170-L200) 方法：

```typescript
// packages/reactivity/src/effect.ts:170-200
run(): T {
  if (!(this.flags & EffectFlags.ACTIVE)) {
    return this.fn()
  }

  this.flags |= EffectFlags.RUNNING
  cleanupEffect(this)
  prepareDeps(this)

  // 🔥 第一个初始化点：保存当前的 activeSub
  const prevEffect = activeSub
  const prevShouldTrack = shouldTrack

  // ⭐ 关键初始化：设置当前 ReactiveEffect 为 activeSub
  activeSub = this                    // 第184行
  shouldTrack = true

  try {
    return this.fn()                  // 执行用户函数，触发依赖收集
  } finally {
    // 清理和依赖管理
    cleanupDeps(this)
    // 🔄 恢复之前的 activeSub 状态
    activeSub = prevEffect            // 第197行
    shouldTrack = prevShouldTrack
    this.flags &= ~EffectFlags.RUNNING
  }
}
```

### 2.2 effect() 函数调用链

[activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L39-L39) 的**最初初始化**发生在 [`effect()`](c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L498-L520) 函数被调用时：

```typescript
// packages/reactivity/src/effect.ts:498-520
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions,
): ReactiveEffectRunner<T> {
  const e = new ReactiveEffect(fn)
  if (options) {
    extend(e, options)
  }
  try {
    e.run() // 🔥 这里会首次设置 activeSub = e
  } catch (err) {
    e.stop()
    throw err
  }
  const runner = e.run.bind(e) as ReactiveEffectRunner
  runner.effect = e
  return runner
}
```

**调用流程**：

1. 用户调用 `effect(fn)`
2. 创建 `ReactiveEffect` 实例
3. 立即调用 `e.run()`
4. 在 `run()` 方法中：`activeSub = this` (第一次真正的初始化)

## 3. computed 相关的初始化

### 3.1 refreshComputed() 函数中的初始化

在 [`refreshComputed()`](c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L385-L439) 函数中也有[activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L39-L39)的初始化：

```typescript
// packages/reactivity/src/effect.ts:415-435
export function refreshComputed(computed: ComputedRefImpl): undefined {
  // ... 前置检查逻辑

  computed.flags |= EffectFlags.RUNNING
  const dep = computed.dep

  // 🔥 第二个初始化点：保存并设置新的 activeSub
  const prevSub = activeSub
  const prevShouldTrack = shouldTrack

  // ⭐ 设置当前 ComputedRefImpl 为 activeSub
  activeSub = computed // 第419行
  shouldTrack = true

  try {
    prepareDeps(computed)
    const value = computed.fn(computed._value) // 执行计算函数
    // ... 处理计算结果
  } finally {
    // 🔄 恢复之前的 activeSub 状态
    activeSub = prevSub // 第434行
    shouldTrack = prevShouldTrack
    cleanupDeps(computed)
    computed.flags &= ~EffectFlags.RUNNING
  }
}
```

## 4. 所有 activeSub 赋值位置汇总

通过代码搜索，找到所有 [activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L39-L39) 的赋值位置：

| 行号 | 位置                   | 赋值内容                 | 触发场景         |
| ---- | ---------------------- | ------------------------ | ---------------- |
| 184  | `ReactiveEffect.run()` | `activeSub = this`       | effect执行时     |
| 197  | `ReactiveEffect.run()` | `activeSub = prevEffect` | effect执行完毕   |
| 419  | `refreshComputed()`    | `activeSub = computed`   | computed求值时   |
| 434  | `refreshComputed()`    | `activeSub = prevSub`    | computed求值完毕 |
| 589  | `cleanupEffect()`      | `activeSub = undefined`  | 清理effect时     |
| 593  | `cleanupEffect()`      | `activeSub = prevSub`    | 清理完毕         |

## 5. 初始化的触发时机

### 5.1 用户代码触发的初始化

```typescript
// 用户代码示例
import { effect, reactive } from 'vue'

const obj = reactive({ count: 0 })

// 🔥 这里会触发 activeSub 的首次初始化
effect(() => {
  console.log(obj.count) // 访问响应式数据时，activeSub 已经被设置
})
```

**执行序列**：

1. `effect(fn)` 被调用
2. 创建 `ReactiveEffect` 实例
3. 调用 `e.run()`
4. **第184行**: `activeSub = this` (首次初始化)
5. 执行 `fn()` → 访问 `obj.count`
6. 触发 [`Dep.track()`](c:\Users\Admin\Downloads\vue3\packages\reactivity\src\dep.ts#L152) → 检查 `activeSub`
7. **第197行**: `activeSub = prevEffect` (恢复)

### 5.2 computed 触发的初始化

```typescript
// computed 示例
import { computed, reactive } from 'vue'

const obj = reactive({ count: 0 })

// 创建 computed（此时还没有初始化 activeSub）
const doubled = computed(() => obj.count * 2)

// 🔥 访问 .value 时触发 activeSub 初始化
console.log(doubled.value)
```

**执行序列**：

1. 访问 `doubled.value`
2. 调用 `ComputedRefImpl.get value()`
3. 调用 `refreshComputed(computed)`
4. **第419行**: `activeSub = computed` (初始化)
5. 执行计算函数 `() => obj.count * 2`
6. 访问 `obj.count` → 触发依赖收集
7. **第434行**: `activeSub = prevSub` (恢复)

## 6. 组件渲染中的初始化

在Vue组件渲染过程中，[activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L39-L39)的初始化更加复杂：

```typescript
// 组件更新时的伪代码流程
function updateComponent(instance) {
  const renderEffect = instance.update // 这是一个 ReactiveEffect

  // 🔥 组件渲染时会设置 activeSub = renderEffect
  renderEffect.run() // 内部会设置 activeSub

  // 在 render 函数执行过程中
  // 访问响应式数据时，activeSub 指向 renderEffect
  // 这样就建立了组件与响应式数据的依赖关系
}
```

## 7. 嵌套场景的处理

Vue 3 使用**栈式管理**来处理嵌套的 effect 或 computed：

```typescript
// 嵌套 effect 示例
effect(() => {
  // activeSub = effect1
  console.log('outer effect')

  effect(() => {
    // activeSub = effect2 (保存 effect1)
    console.log('inner effect')
  }) // activeSub = effect1 (恢复)

  console.log('outer again') // activeSub 仍然是 effect1
}) // activeSub = undefined (恢复)
```

**关键机制**：

- 每次设置新的 [activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L39-L39) 前，都会保存当前值
- 执行完毕后，恢复之前保存的值
- 这确保了嵌套场景下的正确依赖收集

## 8. 调试技巧

### 8.1 在浏览器中调试 activeSub

由于 [activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L39-L39) 不会直接暴露到全局，可以通过以下方式调试：

```typescript
// 在你的 Vue 应用中添加
import { getCurrentInstance } from 'vue'

// 获取当前实例的渲染 effect
const instance = getCurrentInstance()
if (instance) {
  // 可以通过实例访问相关的 effect 信息
  console.log('Current render effect:', instance.update)
}
```

### 8.2 设置断点的关键位置

最佳的断点设置位置：

1. **第184行**: `activeSub = this` (ReactiveEffect 初始化)
2. **第419行**: `activeSub = computed` (computed 初始化)
3. **dep.ts 第152行**: `if (!activeSub || !shouldTrack...)` (依赖收集检查)

## 9. 关键设计原理

### 9.1 为什么使用全局单例

- **简化依赖收集**: 响应式数据只需检查全局的 [activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L39-L39)
- **避免参数传递**: 不需要在每个函数调用中传递当前 effect
- **支持嵌套**: 通过栈式管理支持复杂的嵌套场景

### 9.2 生命周期管理

[activeSub](file://c:\Users\Admin\Downloads\vue3\packages\reactivity\src\effect.ts#L39-L39) 的生命周期严格遵循：

1. **设置** → 2. **执行** → 3. **恢复**

这确保了：

- 依赖收集的准确性
- 内存泄漏的防止
- 嵌套场景的正确处理

## 10. 总结

**activeSub 的初始化逻辑总结**：

1. **默认状态**: 模块加载时为 `undefined`
2. **首次初始化**: 在 `ReactiveEffect.run()` 的第184行
3. **触发时机**:
   - `effect()` 函数调用
   - computed 属性求值
   - 组件渲染更新
4. **管理模式**: 栈式管理，支持嵌套场景
5. **核心作用**: 确定当前活跃的订阅者，实现精确的依赖收集

这种设计是 Vue 3 响应式系统高效运行的核心机制，通过全局状态管理实现了简洁而强大的依赖追踪系统。
