// Analiz betiği: yalnızca kullanıcı yan panelde analiz başlattığında chrome.scripting.executeScript ile
// etkin sekmeye enjekte edilir (manifest'te statik content_scripts yoktur).
// Salt okunurdur: tıklama, form gönderme, klavye simülasyonu yapmaz; input/textarea/select .value okumaz.
import { CONTENT_API_VERSION, type ContentApi, type PageInfo, type SelectorCheck } from '@/shared/contentApi'
import { evaluateLoadState, type LoadState } from '@/shared/loadState'
import { detectTranslation } from '@/shared/translation'
import { runDeterministic } from './axeRunner'
import { clearHighlights, highlight } from './highlight'
import { buildInventory } from './inventory'
import { collectSensitivitySignals } from './signals'

/** Yükleme durumu: readyState + son biten kaynak isteğinden bu yana geçen süre (yalnızca okuma). */
function measureLoadState(): LoadState {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  const lastEnd = resources.reduce((max, r) => Math.max(max, r.responseEnd), 0)
  return evaluateLoadState({
    readyState: document.readyState,
    msSinceLastResource: resources.length > 0 ? Math.round(performance.now() - lastEnd) : null,
    resourceCount: resources.length,
  })
}

function getPageInfo(): PageInfo {
  return {
    url: `${location.origin}${location.pathname}`,
    host: location.host,
    title: document.title,
    lang: document.documentElement.getAttribute('lang'),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    translation: detectTranslation({
      htmlClasses: Array.from(document.documentElement.classList),
      fontWrapperCount: document.querySelectorAll('font[style*="vertical-align"]').length,
    }),
    loadState: measureLoadState(),
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
