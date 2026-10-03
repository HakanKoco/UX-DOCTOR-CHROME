import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Birim testleri saf fonksiyonları (maskeleme, hassas sayfa tespiti, skorlama) Node ortamında çalıştırır.
// CRXJS eklentisi burada yüklenmez.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
