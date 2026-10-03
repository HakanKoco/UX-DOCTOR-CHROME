import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

// İzinler en az düzeyde tutulur; her izin README'de gerekçelendirilir.
// Faz yol haritası: docs/GEREKSINIMLER.md
export default defineManifest({
  manifest_version: 3,
  name: 'UX Doktor',
  description: pkg.description,
  version: pkg.version,
  // chrome.sidePanel API'si Chrome 114+ gerektirir
  minimum_chrome_version: '114',
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_title: 'UX Doktor yan panelini aç',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  permissions: [
    'sidePanel',
  ],
})
