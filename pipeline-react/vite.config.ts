import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 认证服务 - 路径匹配Gateway /auth/**
      '/auth': {
        target: 'http://localhost:8180',
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
  },
})
