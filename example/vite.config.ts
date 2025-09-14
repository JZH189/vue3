import { type UserConfig, defineConfig } from 'vite'
import { URL, fileURLToPath } from 'node:url'

// Vue 3 源码调试配置
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const config: UserConfig = {
  define: {
    __DEV__: true,
    __GLOBAL__: false,
    __FEATURE_OPTIONS_API__: true,
    __FEATURE_PROD_DEVTOOLS__: false,
    __FEATURE_SUSPENSE__: true,
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    __TEST__: false,
    __BROWSER__: true,
    __ESM_BUNDLER__: false,
    __ESM_BROWSER__: true,
    __CJS__: false,
    __SSR__: false,
    __COMPAT__: false,
    __VERSION__: JSON.stringify('3.5.21'), // Vue 版本号
  },
  resolve: {
    alias: {
      // 直接指向 Vue 3 源码，用于调试
      vue: fileURLToPath(
        new URL('../packages/vue/src/index.ts', import.meta.url),
      ),
      '@vue/shared': fileURLToPath(
        new URL('../packages/shared/src/index.ts', import.meta.url),
      ),
      '@vue/runtime-dom': fileURLToPath(
        new URL('../packages/runtime-dom/src/index.ts', import.meta.url),
      ),
      '@vue/runtime-core': fileURLToPath(
        new URL('../packages/runtime-core/src/index.ts', import.meta.url),
      ),
      '@vue/reactivity': fileURLToPath(
        new URL('../packages/reactivity/src/index.ts', import.meta.url),
      ),
      '@vue/compiler-core': fileURLToPath(
        new URL('../packages/compiler-core/src/index.ts', import.meta.url),
      ),
      '@vue/compiler-dom': fileURLToPath(
        new URL('../packages/compiler-dom/src/index.ts', import.meta.url),
      ),
      '@vue/compiler-sfc': fileURLToPath(
        new URL('../packages/compiler-sfc/src/index.ts', import.meta.url),
      ),
      '@vue/server-renderer': fileURLToPath(
        new URL('../packages/server-renderer/src/index.ts', import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    // 允许预构建 babel 相关依赖，避免模块解析错误
    include: [
      '@babel/parser',
      '@babel/types',
      'estree-walker',
      'entities/lib/decode.js',
    ],
    // 仅对源码模块禁用预构建
    exclude: [
      'vue',
      '@vue/shared',
      '@vue/runtime-dom',
      '@vue/runtime-core',
      '@vue/reactivity',
      '@vue/compiler-core',
      '@vue/compiler-dom',
      '@vue/compiler-sfc',
      '@vue/server-renderer',
    ],
  },
  esbuild: {
    // 保留调试信息
    keepNames: true,
    target: 'esnext',
  },
  build: {
    // 保持原始模块结构，便于调试
    rollupOptions: {
      external: [],
    },
  },
  server: {
    // 开发服务器配置
    fs: {
      // 允许访问工作区外的文件
      allow: ['..'],
    },
  },
}

export default defineConfig(config) as UserConfig
