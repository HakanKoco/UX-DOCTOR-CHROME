import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeterministicRaw, PageInfo, SelectorCheck } from '@/shared/contentApi'
import { Browser, fixtureUrl } from './chrome'

// 4. madde: Chrome çevirisinin eklediği <font> sarmalayıcıları seçicilere girmemeli.

let browser: Browser

beforeAll(async () => {
  browser = await Browser.launch()
  await browser.page.open(fixtureUrl('ceviri.html'))
})

afterAll(async () => {
  await browser?.close()
})

describe('çeviri <font> sarmalayıcıları ve seçiciler', () => {
  it('düşük kontrastlı çevrilmiş metnin seçicisi "font" içermez ve anlamlı ata (<p>) işaret eder', async () => {
    const det = await browser.page.evaluate<DeterministicRaw>('globalThis.__uxDoctor.runDeterministic()')
    const contrast = det.findings.filter((f) => f.ruleId === 'color-contrast')
    expect(contrast.length).toBeGreaterThanOrEqual(2)
    for (const f of contrast) {
      expect(f.selector).not.toMatch(/font/i)
      expect(f.evidence.highlightable).toBe(true)
      const tag = await browser.page.evaluate<string | null>(
        `(() => { const m = document.querySelectorAll(${JSON.stringify(f.selector)}); return m.length === 1 ? m[0].tagName : null })()`,
      )
      expect(tag).toBe('P')
    }
    expect(contrast.map((f) => f.selector)).toContain('#hedef-paragraf')
  })

  it('tüm bulgu seçicileri sayfada tek öğe bulur ve hiçbiri "font" içermez', async () => {
    const det = await browser.page.evaluate<DeterministicRaw>('globalThis.__uxDoctor.runDeterministic()')
    const selectors = det.findings.filter((f) => f.evidence.highlightable).map((f) => f.selector)
    expect(selectors.length).toBeGreaterThan(0)
    for (const s of selectors) expect(s).not.toMatch(/(^|[\s>])font\b/i)
    const checks = await browser.page.evaluate<SelectorCheck[]>(`globalThis.__uxDoctor.checkSelectors(${JSON.stringify(selectors)})`)
    for (const c of checks) expect(c.count, c.selector).toBe(1)
  })

  it('envanterdeki bağlantıların seçicileri "font" içermez', async () => {
    const inv = await browser.page.evaluate<{ elements: { tag: string; selector: string }[] }>('globalThis.__uxDoctor.buildInventory()')
    const links = inv.elements.filter((e) => e.tag === 'a')
    expect(links.length).toBe(2)
    for (const l of links) expect(l.selector).not.toMatch(/font/i)
  })

  it('çeviri tespit edilir ve gerekçeleri yazılır', async () => {
    const info = await browser.page.evaluate<PageInfo>('globalThis.__uxDoctor.getPageInfo()')
    expect(info.translation.detected).toBe(true)
    expect(info.translation.reasons.join(' ')).toContain('translated-ltr')
    expect(info.translation.reasons.join(' ')).toContain('<font>')
  })
})
