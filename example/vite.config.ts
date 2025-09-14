import { type UserConfig, defineConfig } from 'vite'
import { URL, fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'

const config: UserConfig = {
  plugins: [
    // Vue 插件配置，支持源码调试
    vue({
      include: [/\.vue$/, /\.md$/],
    }),
  ],
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
    // 允许预构建必要的依赖
    include: ['@babel/parser', '@babel/types', 'estree-walker'],
    // 禁用所有Vue源码模块的预构建，让它们使用别名解析
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
    // 保留调试信息和源码映射
    keepNames: true,
    target: 'esnext',
    sourcemap: true,
  },
  build: {
    // 保持原始模块结构，便于调试
    sourcemap: true,
    rollupOptions: {
      external: [],
    },
  },
  css: {
    // 启用CSS sourcemap
    devSourcemap: true,
  },
  server: {
    // 开发服务器配置
    fs: {
      // 允许访问工作区外的文件
      allow: ['..'],
    },
    // 启用sourcemap
    sourcemapIgnoreList: false,
  },
}

export default defineConfig(config) as UserConfig
