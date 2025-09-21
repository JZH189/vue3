import { createApp } from 'vue'
import App from './App.vue'

// Vue DevTools通常由浏览器扩展自动注入，无需手动初始化
// 如果需要支持没有扩展的环境，可以使用以下代码：
// if (import.meta.env.DEV && typeof globalThis !== 'undefined') {
//   globalThis.__VUE_DEVTOOLS_GLOBAL_HOOK__ = globalThis.__VUE_DEVTOOLS_GLOBAL_HOOK__ || {}
// }

createApp(App).mount('#app')
