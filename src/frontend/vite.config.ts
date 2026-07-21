import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Backend is LIVE FastAPI on http://localhost:8000 (electron/main.ts:201-301 spawns Python subprocess)
      // All frontend API calls use /api/v1/* prefix (18 routers mounted)
      // Vite proxy passes /api/* paths through unchanged — no rewrite needed
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || (id.includes('/react/') && !id.includes('react-'))) {
              return 'vendor-react'
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-ui'
            }
            if (id.includes('@tiptap')) {
              return 'vendor-tiptap'
            }
            if (id.includes('react-force-graph') || id.includes('3d-force-graph') || id.includes('three')) {
              return 'vendor-force-graph'
            }
            if (id.includes('zustand') || id.includes('immer')) {
              return 'vendor-zustand'
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts'
            }
          }
        },
      },
    },
  },
})
