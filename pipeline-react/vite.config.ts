import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const gatewayTarget = 'http://localhost:8180'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: gatewayTarget,
        changeOrigin: true,
      },
      '/project': {
        target: gatewayTarget,
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/pipeline': {
        target: gatewayTarget,
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/pump-station': {
        target: gatewayTarget,
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/oil-property': {
        target: gatewayTarget,
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/knowledge-doc': {
        target: gatewayTarget,
        changeOrigin: true,
        rewrite: (path) => `/data${path}`,
      },
      '/calculation': {
        target: gatewayTarget,
        changeOrigin: true,
      },
      '/api/v1': {
        target: 'http://localhost:8200',
        changeOrigin: true,
      },
    },
  },
})
