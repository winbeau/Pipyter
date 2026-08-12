import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const runtimeTarget = process.env.PIPYTER_DEV_RUNTIME || 'http://127.0.0.1:8895'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Runtime API (pipyter serve / pipyter up) during development.
      '/api': {
        target: runtimeTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    // The runtime API serves the built portal from src/pipyter/static.
    outDir: '../src/pipyter/static',
    emptyOutDir: true,
  },
})
