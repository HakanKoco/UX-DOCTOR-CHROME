import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Tarayıcı testleri (npm run test:browser): yüklü Chrome başsız açılır, yerel fixture'lara derlenmiş analiz
// betiği (dist) enjekte edilir. Önce "npm run build" gerekir. Birim testlerinden (npm test) ayrıdır.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: ['tests/browser/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
