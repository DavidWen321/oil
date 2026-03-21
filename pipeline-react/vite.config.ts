import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';
import type { ManualChunkMeta } from 'rollup';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 认证服务 - 路径匹配Gateway /auth/**
      '/auth': {
<<<<<<< Updated upstream
        target: 'http://localhost:8180',
=======
        target: 'http://localhost:9300',
>>>>>>> Stashed changes
        changeOrigin: true,
      },
      // 数据服务 - 前端用 /project /pipeline 等，Gateway需要 /data/ 前缀
      '/project': {
        target: 'http://localhost:8180',
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/pipeline': {
        target: 'http://localhost:8180',
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/pump-station': {
        target: 'http://localhost:8180',
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/oil-property': {
        target: 'http://localhost:8180',
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      // 计算服务 - 路径匹配Gateway /calculation/**
      '/calculation': {
        target: 'http://localhost:8180',
        changeOrigin: true,
      },
      // Agent API
      '/api/v1': {
        target: 'http://localhost:8200',
        changeOrigin: true,
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
          manualChunks: (id: string, _meta: ManualChunkMeta) => {
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
  };
});
