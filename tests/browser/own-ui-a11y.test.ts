import { readFileSync, existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AXE_FORCE_ENABLED_RULES, AXE_TAGS } from '@/shared/axeMapping'
import { newProgress, withPause } from '@/shared/consistencyProgress'
import { buildLlmRequest } from '@/shared/llmRequest'
import { sampleInventory } from '@/shared/testFixtures'
import { Browser } from './chrome'

// Kendi arayüzümüz kendi kurallarımızdan geçmeli: derlenmiş yan panel ve ayarlar sayfası, eklentinin sayfalara
// uyguladığı axe kurallarıyla (WCAG 2.2 AA etiketleri + açıkça etkinleştirilen kurallar) taranır; ayrıca en küçük yazı
// boyutu ve klavye odak göstergesi ölçülür. Açık ve koyu tema ayrı ayrı denetlenir.
//
// Yöntem: dist/ küçük bir yerel HTTP sunucusuyla verilir; chrome.* API'leri yalnızca bu testte sahte bir nesneyle
// karşılanır (Page.addScriptToEvaluateOnNewDocument). Sınır: yalnızca analiz öncesi görünen durumlar (ayarlar
// özeti, yarım kalan tutarlılık testi kartı, ayarlar formu) taranır; bulgu listeleri ve onay ekranı elle denetlenir.

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const DIST = path.join(ROOT, 'dist')
const AXE_SOURCE = path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js')
const MIN_FONT_PX = 13

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
}

function startServer(): Promise<Server> {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    const file = path.join(DIST, urlPath)
    if (!file.startsWith(DIST) || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

/** Yalnızca test için sahte chrome nesnesi; depo başlangıç değerleriyle doldurulur. Anahtar sahte bir yer tutucudur. */
function chromeStub(store: Record<string, unknown>): string {
  return `(() => {
    const store = ${JSON.stringify(store)};
    const ev = () => ({ addListener() {}, removeListener() {} });
    const pick = (keys) => {
      if (keys == null) return { ...store };
      const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
      return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
    };
    globalThis.chrome = {
      storage: {
        local: {
          get: async (keys) => pick(keys),
          set: async (o) => { Object.assign(store, o) },
          remove: async (k) => { for (const key of [].concat(k)) delete store[key] },
        },
        onChanged: ev(),
      },
      runtime: {
        id: 'test',
        getManifest: () => ({ version: '0.0.0-test' }),
        getURL: (p) => location.origin + '/' + p,
        openOptionsPage() {},
        sendMessage: async () => ({ ok: false, message: 'test' }),
        connect: () => ({ postMessage() {}, disconnect() {}, onMessage: ev(), onDisconnect: ev() }),
      },
      permissions: { contains: async () => false, request: async () => false, remove: async () => true },
      tabs: { query: async () => [] },
      scripting: { executeScript: async () => [] },
    };
  })();`
}

const inventory = sampleInventory()
const pausedRecord = withPause(
  newProgress({
    page: {
      url: 'https://ornek.test/',
      host: 'ornek.test',
      title: 'Örnek',
      lang: 'tr',
      viewport: { width: 1, height: 1 },
      translation: { detected: false, reasons: [] },
    },
    request: buildLlmRequest('gemini-3.8-flash', inventory),
    inventory,
    requestedRuns: 3,
  }),
  'Gemini API geçici olarak kullanılamıyor (503).',
)

const STORE = {
  provider: 'gemini',
  geminiApiKey: 'TEST-ONLY-placeholder-not-a-real-key',
  geminiModel: 'gemini-3.8-flash',
  consistencyProgress: pausedRecord,
}

interface AxeViolation {
  id: string
  nodes: { target: string[] }[]
}

let server: Server
let browser: Browser
let base: string

beforeAll(async () => {
  server = await startServer()
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  browser = await Browser.launch()
  await browser.page.addInitScript(chromeStub(STORE))
})

afterAll(async () => {
  await browser?.close()
  await new Promise((r) => server?.close(r))
})

async function openUi(page: string, scheme: 'light' | 'dark') {
  await browser.page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
  await browser.page.open(`${base}/src/${page}/index.html`, false)
  await browser.page.waitFor(`document.querySelector('#root h1')`)
  // Ayarlar yüklenip yeniden çizilsin.
  await new Promise((r) => setTimeout(r, 300))
}

async function axeViolations(): Promise<string[]> {
  await browser.page.evaluate(readFileSync(AXE_SOURCE, 'utf8'), false)
  const rules = Object.fromEntries(AXE_FORCE_ENABLED_RULES.map((id) => [id, { enabled: true }]))
  const options = JSON.stringify({ runOnly: { type: 'tag', values: [...AXE_TAGS] }, rules })
  const violations = await browser.page.evaluate<AxeViolation[]>(
    `axe.run(document, ${options}).then((r) => r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target })) })))`,
  )
  return violations.flatMap((v) => v.nodes.map((n) => `${v.id} @ ${n.target.join(' ')}`))
}

/** Görünür, kendi metni olan her öğenin hesaplanan yazı boyutu en az MIN_FONT_PX mi. */
async function smallTexts(): Promise<string[]> {
  return browser.page.evaluate<string[]>(`(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');
      if (!ownText || el.getClientRects().length === 0) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < ${MIN_FONT_PX}) out.push(el.tagName.toLowerCase() + '.' + el.className + ' = ' + size + 'px: ' + el.textContent.trim().slice(0, 40));
    }
    return out;
  })()`)
}

/** Tab ile gezilen her öğede görünür odak göstergesi (en az 2 px çerçeve) var mı. */
async function focusProblems(): Promise<{ visited: number; problems: string[] }> {
  await browser.page.evaluate(`document.activeElement && document.activeElement.blur()`)
  const seen = new Set<string>()
  const problems: string[] = []
  for (let i = 0; i < 40; i++) {
    await browser.page.pressTab()
    const info = await browser.page.evaluate<{ key: string; outline: string; width: number } | null>(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const key = el.tagName.toLowerCase() + '|' + (el.id || '') + '|' + (el.textContent || '').trim().slice(0, 30);
      return { key, outline: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
    })()`)
    if (!info) continue
    if (seen.has(info.key)) break
    seen.add(info.key)
    if (info.outline === 'none' || info.width < 2) problems.push(`${info.key} (outline: ${info.outline} ${info.width}px)`)
  }
  return { visited: seen.size, problems }
}

describe.each([
  ['sidepanel', 'light'],
  ['sidepanel', 'dark'],
  ['options', 'light'],
  ['options', 'dark'],
] as const)('kendi arayüzümüz: %s (%s tema)', (page, scheme) => {
  beforeAll(async () => {
    await openUi(page, scheme)
  })

  it('axe (WCAG 2.2 AA etiketleri + eklentinin zorunlu kuralları): ihlal yok', async () => {
    expect(await axeViolations()).toEqual([])
  })

  it(`hiçbir görünür metin ${MIN_FONT_PX} px'ten küçük değil`, async () => {
    expect(await smallTexts()).toEqual([])
  })

  it('Tab ile gezilen her öğede görünür odak çerçevesi var', async () => {
    const { visited, problems } = await focusProblems()
    expect(visited).toBeGreaterThan(0)
    expect(problems).toEqual([])
  })
})
