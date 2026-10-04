import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Teslim kontrolü (npm run teslim-kontrol): reports/, ölçüm yer tutucuları, anahtar taraması, commit geçmişi ve
// izin tablosu. Birim ve tarayıcı testlerinden ayrıdır; hiçbir ölçüm değeri üretmez.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: ['scripts/teslim-kontrol.check.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
})
