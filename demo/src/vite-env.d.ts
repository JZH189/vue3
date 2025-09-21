/// <reference types="vite/client" />

// 引入Vue 3的全局类型定义
/// <reference types="../packages/global" />

// 确保__VERSION__和__COMMIT__有正确的类型声明
declare const __VERSION__: string
declare const __COMMIT__: string

// 声明Vue DevTools全局钩子类型
declare global {
  interface Window {
    __VUE_DEVTOOLS_GLOBAL_HOOK__?: {
      Vue?: any
      [key: string]: any
    }
  }
}

// 导出空对象确保这是一个模块
export {}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
