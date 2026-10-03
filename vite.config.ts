import fs from 'node:fs'
import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { name, version } from './package.json'

/**
 * CRXJS, `?iife` ile içe aktarılan betikleri web_accessible_resources listesine ekler. Bu betik yalnızca
 * chrome.scripting.executeScript ile enjekte edildiği için web sayfalarının erişmesine gerek yok;
 * listede kalırsa her site eklentinin varlığını tespit edebilir. Bu eklenti o kaydı derleme çıktısından siler.
 */
function stripInjectedScriptsFromWar(): Plugin {
  return {
    name: 'ux-doktor:strip-war',
    enforce: 'post',
    // CRXJS manifest'i kendi generateBundle aşamasında yazdığı için diske yazıldıktan sonra düzeltiyoruz.
    writeBundle(options) {
      const file = path.join(options.dir ?? 'dist', 'manifest.json')
      if (!fs.existsSync(file)) return
      const json = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (Array.isArray(json.web_accessible_resources)) {
        json.web_accessible_resources = json.web_accessible_resources
          .map((entry: { resources: string[] }) => ({
            ...entry,
            resources: entry.resources.filter((r) => !r.startsWith('src/content/')),
          }))
          .filter((entry: { resources: string[] }) => entry.resources.length > 0)
        if (json.web_accessible_resources.length === 0) delete json.web_accessible_resources
      }
      fs.writeFileSync(file, JSON.stringify(json, null, 2))
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    react(),
    crx({ manifest }),
    stripInjectedScriptsFromWar(),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
})
