import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const authTarget = process.env.VITE_AUTH_TARGET || 'http://127.0.0.1:9300'
const dataTarget = process.env.VITE_DATA_TARGET || 'http://127.0.0.1:9400'
const calculationTarget = process.env.VITE_CALCULATION_TARGET || 'http://127.0.0.1:9500'
const agentTarget = process.env.VITE_AGENT_TARGET || 'http://127.0.0.1:8100'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: authTarget,
        changeOrigin: true,
      },
      '/project': {
        target: dataTarget,
        changeOrigin: true,
      },
      '/pipeline': {
        target: dataTarget,
        changeOrigin: true,
      },
      '/pump-station': {
        target: dataTarget,
        changeOrigin: true,
      },
      '/oil-property': {
        target: dataTarget,
        changeOrigin: true,
      },
      '/knowledge-doc': {
        target: dataTarget,
        changeOrigin: true,
      },
      '/calculation': {
        target: calculationTarget,
        changeOrigin: true,
      },
      '/api/v1': {
        target: agentTarget,
        changeOrigin: true,
      },
      '/api/v2': {
        target: agentTarget,
        changeOrigin: true,
      },
    },
  },
})
