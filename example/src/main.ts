import { createApp } from 'vue'
import { computed, ref } from 'vue'
import App from './App.vue'
import './style.css'

// 为了方便调试，在这里设置一个断点
console.info('🗨️ Vue 3 应用启动中... (源码调试模式)')

// 演示如何在Vue源码中调试
// debugger // 您可以在此处设置断点，可以进入createApp函数内部

// 创建 Vue 应用实例（可以跳转到Vue源码）
const app = createApp(App)

// 演示响应式API调试
const count = ref(0)
const doubleCount = computed(() => count.value * 2)

console.info('🔍 响应式数据调试:', {
  count: count.value,
  doubleCount: doubleCount.value,
})

// 挂载到 DOM（可以跳转到render源码）
app.mount('#app')

console.info('✅ Vue 3 应用已启动')
console.info('📜 调试提示:')
console.info('1. 在浏览器开发者工具中，您可以直接跳转到Vue源码')
console.info('2. 在createApp、ref、computed等函数上设置断点')
console.info('3. 源码路径: packages/runtime-dom/src/index.ts 等')
