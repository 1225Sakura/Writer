import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // US-020: e2e/journeys/** are Playwright specs (run via `npm run e2e`),
    // not Vitest unit tests. Excluding them keeps `npm test` focused on
    // pure unit/integration coverage and prevents Vite from choking on
    // `@playwright/test` imports.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'e2e/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
