import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/helpdesk/',
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
  },
})
