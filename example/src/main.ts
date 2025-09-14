import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// 为了方便调试，在这里设置一个断点
console.info('🗨️ Vue 3 应用启动中... (源码调试模式)')
// 创建 Vue 应用实例（可以跳转到Vue源码）
const app = createApp(App)

// 挂载到 DOM（可以跳转到render源码）
app.mount('#app')

console.info('✅ Vue 3 应用已启动')
console.info('📜 调试提示:')
console.info('1. 在浏览器开发者工具中，您可以直接跳转到Vue源码')
console.info('2. 在createApp、ref、computed等函数上设置断点')
console.info('3. 源码路径: packages/runtime-dom/src/index.ts 等')
