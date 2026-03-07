import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';
import type { ManualChunkMeta } from 'rollup';

export default defineConfig({
  define: {
    // 为 sockjs-client 提供 global 变量
    global: 'globalThis',
  },

  plugins: [
    react(),

    // Gzip 压缩
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240, // 10KB 以上才压缩
      algorithm: 'gzip',
      ext: '.gz',
    }),

    // Brotli 压缩（更高压缩率）
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'brotliCompress',
      ext: '.br',
    }),

    // 包体积分析（仅在构建时生成）
    visualizer({
      open: false,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],

  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/project': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/pipeline': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/pump-station': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/oil-property': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/calculation': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
      '/api/v1': {
        target: 'http://localhost:8100',
        changeOrigin: true,
      },
      '/api/v2': {
        target: 'http://localhost:8100',
        changeOrigin: true,
      },
    },
  },

  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除 console
        drop_debugger: true,
      },
    },

    // 代码分割策略
    rollupOptions: {
      output: {
        manualChunks: (id: string, meta: ManualChunkMeta) => {
          // React 核心库
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }

          // React Router
          if (id.includes('node_modules/react-router-dom')) {
            return 'vendor-router';
          }

          // Ant Design UI 库
          if (id.includes('node_modules/antd')) {
            return 'vendor-antd';
          }

          // Ant Design Icons
          if (id.includes('node_modules/@ant-design/icons')) {
            return 'vendor-icons';
          }

          // ECharts 图表库
          if (id.includes('node_modules/echarts') || id.includes('node_modules/@ant-design/charts')) {
            return 'vendor-charts';
          }

          // Markdown 渲染相关
          if (
            id.includes('node_modules/react-markdown') ||
            id.includes('node_modules/remark-') ||
            id.includes('node_modules/rehype-')
          ) {
            return 'vendor-markdown';
          }

          // 工具库（axios, zustand, dayjs 等）
          if (
            id.includes('node_modules/axios') ||
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/dayjs')
          ) {
            return 'vendor-utils';
          }

          // 动画库
          if (id.includes('node_modules/motion') || id.includes('node_modules/@use-gesture')) {
            return 'vendor-animation';
          }

          // WebSocket 相关
          if (id.includes('node_modules/@stomp') || id.includes('node_modules/sockjs-client')) {
            return 'vendor-websocket';
          }

          // 其他第三方库
          if (id.includes('node_modules')) {
            return 'vendor-other';
          }
        },

        // 文件命名策略（带 hash 便于缓存）
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },

    // 分块大小警告阈值
    chunkSizeWarningLimit: 1000, // 1MB

    // 启用 CSS 代码分割
    cssCodeSplit: true,

    // 生成 sourcemap（生产环境可关闭）
    sourcemap: false,
  },

  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      'axios',
      'zustand',
      'dayjs',
    ],
    exclude: ['echarts'], // ECharts 按需加载
  },
});
