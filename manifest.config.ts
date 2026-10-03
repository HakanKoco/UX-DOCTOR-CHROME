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
    'storage',
    // Kullanıcının simgeye tıkladığı sekmeye geçici erişim; sayfadan ayrılınca düşer.
    'activeTab',
    // Analiz betiğini yalnızca kullanıcı analiz başlattığında enjekte etmek için.
    'scripting',
  ],
  // Kurulumda istenmez. Yalnızca activeTab yetmediğinde kullanıcı yan paneldeki düğmeyle açıkça verir,
  // ayarlar sayfasından geri alabilir. Değer src/sidepanel/tabBridge.ts içindeki OPTIONAL_ORIGINS ile aynı.
  optional_host_permissions: [
    'http://*/*',
    'https://*/*',
  ],
  // Service worker'ın Claude API isteklerinin CORS nedeniyle engellenmemesi için yalnızca bu alan adı.
  host_permissions: [
    'https://api.anthropic.com/*',
  ],
})
