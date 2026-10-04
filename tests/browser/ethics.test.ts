import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeterministicRaw } from '@/shared/contentApi'
import type { Inventory } from '@/shared/inventory'
import { buildLlmRequest } from '@/shared/llmRequest'
import { ANALYZER_BUNDLE, Browser, fixtureUrl } from './chrome'

// Etik son tarama (Ödev §5): form alanı değerleri ve klavye olayları okunmaz, LLM'e gitmez.
// dolu-form.html'deki her değer "GIZLI-" işaretlidir (attribute, kullanıcının yazdığını taklit eden property,
// textarea, select değeri, hidden, contenteditable, submit düğmesi). Bu işaretler hiçbir çıktıda geçmemelidir.
//
// Ayrıca analiz betiği sayfaya enjekte edilmeden ÖNCE iki kayıtçı kurulur (yalnızca testte):
// - addEventListener çağrılarının olay türleri (klavye/girdi dinleyicisi eklenmemeli),
// - input/textarea/select öğelerinin .value okuyucusuna erişim sayısı (her API çağrısı için ayrı).

const MARKER = 'GIZLI-'
const FORBIDDEN_EVENTS = ['keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'change', 'paste', 'copy', 'cut', 'compositionstart', 'compositionend']

const RECORDER = `(() => {
  const rec = { events: [], valueReads: 0 };
  globalThis.__ethicsRecorder = rec;
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    rec.events.push(String(type));
    return add.call(this, type, ...rest);
  };
  for (const proto of [HTMLInputElement.prototype, HTMLTextAreaElement.prototype, HTMLSelectElement.prototype]) {
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    Object.defineProperty(proto, 'value', {
      configurable: true,
      get() { rec.valueReads++; return d.get.call(this); },
      set(v) { d.set.call(this, v); },
    });
  }
})()`

let browser: Browser
let inventory: Inventory
let det: DeterministicRaw
let signals: unknown
const valueReads: Record<string, number> = {}
let events: string[] = []

async function call<T>(name: string, expr: string): Promise<T> {
  await browser.page.evaluate(`globalThis.__ethicsRecorder.valueReads = 0`)
  const result = await browser.page.evaluate<T>(expr)
  valueReads[name] = await browser.page.evaluate<number>(`globalThis.__ethicsRecorder.valueReads`)
  return result
}

beforeAll(async () => {
  browser = await Browser.launch()
  await browser.page.open(fixtureUrl('dolu-form.html'), false)
  // Sayfanın kendi betiği değerleri yazdıktan sonra kayıtçılar kurulur, ardından analiz betiği enjekte edilir.
  await browser.page.evaluate(RECORDER, false)
  await browser.page.evaluate(readFileSync(ANALYZER_BUNDLE, 'utf8'), false)

  await call('getPageInfo', 'globalThis.__uxDoctor.getPageInfo()')
  signals = await call('collectSensitivitySignals', 'globalThis.__uxDoctor.collectSensitivitySignals()')
  inventory = await call('buildInventory', 'globalThis.__uxDoctor.buildInventory()')
  det = await call('runDeterministic', 'globalThis.__uxDoctor.runDeterministic()')
  const selectors = JSON.stringify(inventory.elements.map((e) => e.selector))
  await call('checkSelectors', `globalThis.__uxDoctor.checkSelectors(${selectors})`)
  const items = JSON.stringify(det.findings.map((f) => ({ selector: f.selector, label: f.rule, severity: f.severity })))
  await call('highlight', `globalThis.__uxDoctor.highlight(${items}, false)`)
  await call('clearHighlights', 'globalThis.__uxDoctor.clearHighlights()')
  events = await browser.page.evaluate<string[]>('globalThis.__ethicsRecorder.events')
})

afterAll(async () => {
  await browser?.close()
})

describe('etik tarama: dolu form sayfası', () => {
  it('fixture gerçekten dolu: sayfada işaretli değerler var (testin kendisi boşa geçmesin)', async () => {
    expect(await browser.page.evaluate<string>(`document.getElementById('ad').value`)).toBe('GIZLI-YAZILAN-8')
    expect(inventory.elements.length).toBeGreaterThan(3)
    expect(det.findings.length).toBeGreaterThan(0)
  })

  it('envanterde hiçbir form değeri yok', () => {
    expect(JSON.stringify(inventory)).not.toContain(MARKER)
  })

  it('LLM istek gövdesinde (Gemini ve Claude) form değeri yok ve telefon maskeli', () => {
    for (const model of ['gemini-3.8-flash', 'claude-opus-5-5'] as const) {
      const body = JSON.stringify(buildLlmRequest(model, inventory).body)
      expect(body).not.toContain(MARKER)
      expect(body).not.toContain('0532 123 45 67')
    }
  })

  it('deterministik bulgularda (HTML kanıtı, açıklama, öneri, elle incelenecekler) form değeri yok', () => {
    expect(JSON.stringify(det)).not.toContain(MARKER)
  })

  it('gizlilik sinyallerinde form değeri yok', () => {
    expect(JSON.stringify(signals)).not.toContain(MARKER)
  })

  it('analiz betiği klavye ya da girdi dinleyicisi eklemez', () => {
    expect(events.filter((t) => FORBIDDEN_EVENTS.includes(t))).toEqual([])
  })

  it('kendi kodumuz (envanter, gizlilik sinyalleri, seçici, vurgulama) .value okumaz', () => {
    for (const name of ['getPageInfo', 'collectSensitivitySignals', 'buildInventory', 'checkSelectors', 'highlight', 'clearHighlights']) {
      expect(valueReads[name], name).toBe(0)
    }
  })

  it('axe-core (runDeterministic) .value okuyucusuna erişimi ölçülür ve çıktıya sızmaz', () => {
    // axe-core'un iç kurallarının değeri okuyup okumadığı burada kayda geçer; okusa bile yukarıdaki test
    // değerin hiçbir çıktıya girmediğini doğrular. Sayı README "Gizlilik ve güvenlik" bölümünde açıklanır.
    console.log(`axe-core çalışırken .value okuma sayısı: ${valueReads.runDeterministic}`)
    expect(valueReads.runDeterministic).toBeGreaterThanOrEqual(0)
  })
})
