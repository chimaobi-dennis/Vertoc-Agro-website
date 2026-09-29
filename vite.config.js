import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // Content API during local dev; see server/ for the backend.
    // VITE_PROXY_TARGET points the dev server at another backend (a local test stack).
    proxy: { '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:8787' },
  },
})
