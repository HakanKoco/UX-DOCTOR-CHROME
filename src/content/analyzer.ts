// Analiz betiği: yalnızca kullanıcı yan panelde analiz başlattığında chrome.scripting.executeScript ile
// etkin sekmeye enjekte edilir (manifest'te statik content_scripts yoktur).
// Salt okunurdur: tıklama, form gönderme, klavye simülasyonu yapmaz; input/textarea/select .value okumaz.
import { CONTENT_API_VERSION, type ContentApi, type PageInfo, type SelectorCheck } from '@/shared/contentApi'
import { runDeterministic } from './axeRunner'
import { clearHighlights, highlight } from './highlight'
import { buildInventory } from './inventory'
import { collectSensitivitySignals } from './signals'

function getPageInfo(): PageInfo {
  return {
    url: `${location.origin}${location.pathname}`,
    host: location.host,
    title: document.title,
    lang: document.documentElement.getAttribute('lang'),
    viewport: { width: window.innerWidth, height: window.innerHeight },
  }
}

function checkSelectors(selectors: string[]): SelectorCheck[] {
  return selectors.map((selector) => {
    try {
      return { selector, count: document.querySelectorAll(selector).length }
    } catch {
      return { selector, count: 0 }
    }
  })
}

if (globalThis.__uxDoctor?.version !== CONTENT_API_VERSION) {
  const api: ContentApi = {
    version: CONTENT_API_VERSION,
    getPageInfo,
    runDeterministic: async () => {
      clearHighlights() // vurgulama katmanı analiz sonucunu etkilemesin
      return runDeterministic()
    },
    highlight,
    clearHighlights,
    checkSelectors,
    collectSensitivitySignals,
    buildInventory: (limit?: number) => {
      clearHighlights() // vurgulama katmanı envantere girmesin
      return buildInventory(limit)
    },
  }
  globalThis.__uxDoctor = api
}
