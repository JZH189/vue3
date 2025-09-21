import { defineConfig } from 'vite'
// @ts-expect-error
import vue from '@vitejs/plugin-vue'
/* eslint-disable import-x/no-nodejs-modules */
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@vue/shared': resolve(__dirname, '../packages/shared/src'),
      '@vue/reactivity': resolve(__dirname, '../packages/reactivity/src'),
      '@vue/runtime-core': resolve(__dirname, '../packages/runtime-core/src'),
      '@vue/runtime-dom': resolve(__dirname, '../packages/runtime-dom/src'),
      vue: resolve(__dirname, '../packages/vue/src'),
    },
  },
  define: {
    __DEV__: true,
    __TEST__: false,
    __BROWSER__: true,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __NODE_JS__: false,
    __SSR__: false,
    __FEATURE_OPTIONS_API__: true,
    __FEATURE_PROD_DEVTOOLS__: false,
    __FEATURE_SUSPENSE__: true,
    __COMPAT__: false,
    __VERSION__: '"3.5.21"',
    __COMMIT__: '"demo"',
  },
  server: {
    port: 3000,
    open: true,
  },
})
