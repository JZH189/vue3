# Vue 3 源码调试指南

## 🎯 项目说明

这个示例项目已经配置为直接使用Vue 3的TypeScript源码，而不是编译后的版本。您可以在浏览器中直接调试Vue 3的源码。

## 🛠️ 配置说明

### Vite配置 (vite.config.ts)

- **别名配置**: 所有Vue模块都指向源码路径 (`packages/*/src/index.ts`)
- **Sourcemap**: 启用完整的sourcemap支持
- **调试优化**: 保留函数名和调试信息

### 核心别名配置

```typescript
vue: '../packages/vue/src/index.ts'
'@vue/runtime-dom': '../packages/runtime-dom/src/index.ts'
'@vue/runtime-core': '../packages/runtime-core/src/index.ts'
'@vue/reactivity': '../packages/reactivity/src/index.ts'
// ... 等等
```

## 🔍 调试方法

### 1. 在浏览器开发者工具中调试

1. **打开浏览器开发者工具** (F12)
2. **进入Sources标签页**
3. **查找Vue源码文件**:
   - 导航到 `webpack://vue3-example-todo/` 或类似路径
   - 找到 `packages` 文件夹
   - 您可以看到完整的Vue 3源码目录结构

### 2. 设置断点的关键位置

#### A. 应用启动调试

- **文件**: `src/main.ts`
- **位置**: `createApp()` 调用处
- **可以跳转到**: `packages/runtime-dom/src/index.ts` 中的 `createApp` 函数

#### B. 响应式系统调试

- **文件**: `src/App.vue` 或 `src/main.ts`
- **位置**: `ref()`, `computed()`, `watch()` 调用处
- **可以跳转到**: `packages/reactivity/src/ref.ts`, `packages/reactivity/src/computed.ts` 等

#### C. 组件渲染调试

- **文件**: 任何Vue组件
- **位置**: 模板更新、数据变化时
- **可以跳转到**: `packages/runtime-core/src/renderer.ts` 等

### 3. 具体调试步骤

1. **启动应用**: 访问 http://localhost:5174
2. **打开控制台**: 查看调试日志信息
3. **设置断点**:
   ```javascript
   // 在main.ts中已经添加了debugger语句
   debugger // 在此处会自动暂停
   ```
4. **进入函数**: 使用F11键进入Vue源码函数内部
5. **查看调用栈**: 观察Vue内部的函数调用流程

## 📁 源码文件说明

### 核心模块文件位置

- **入口**: `packages/vue/src/index.ts`
- **DOM运行时**: `packages/runtime-dom/src/index.ts`
- **核心运行时**: `packages/runtime-core/src/index.ts`
- **响应式系统**: `packages/reactivity/src/index.ts`
- **编译器**: `packages/compiler-core/src/index.ts`

### 示例中的调试点

1. **main.ts**: 应用启动和响应式API调试
2. **App.vue**: 组件生命周期和计算属性调试
3. **任何用户交互**: 事件处理和DOM更新调试

## 🎯 调试技巧

### 1. 响应式系统调试

```typescript
// 在computed中设置断点
const filteredTodos = computed(() => {
  debugger // 观察响应式依赖收集
  return todos.value.filter(todo => !todo.completed)
})
```

### 2. 渲染系统调试

- 在数据变化时观察`render`函数的调用
- 查看虚拟DOM的diff算法执行过程

### 3. 事件系统调试

- 在点击事件处理函数中设置断点
- 观察事件的捕获和冒泡过程

## 🚀 使用场景

1. **学习Vue 3源码**: 理解框架内部工作原理
2. **性能优化**: 分析响应式系统的性能瓶颈
3. **Bug调试**: 深入理解组件行为异常的根本原因
4. **功能开发**: 基于源码理解开发自定义功能

## ⚠️ 注意事项

1. **性能**: 源码调试模式性能比生产版本慢
2. **稳定性**: 直接使用源码可能遇到未发布的变更
3. **学习**: 建议配合Vue 3文档一起使用

## 🔧 故障排除

如果遇到问题：

1. 确保所有依赖已正确安装: `pnpm install`
2. 重启开发服务器: `pnpm dev`
3. 清除浏览器缓存
4. 检查控制台错误信息

---

现在您可以开始在Vue 3源码中愉快地调试了！🎉
