import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { categoryForRule } from '@/shared/axeMapping'
import type { DeterministicRaw } from '@/shared/contentApi'
import { Browser, FIXTURES, fixtureUrl } from './chrome'

// 9. madde: bilinen hatalarla dolu test sayfası. Deterministik katman beklenen.json'daki her hatayı yakalamalı ve
// "hataOlmamali" kontrol öğelerinde yanlış alarm vermemeli. (Sonuçlar docs/manuel-karsilastirma.md'ye yazılmaz.)

interface Expected {
  hatalar: { id: string; hata: string; kural: string; wcag: string; kategori: string; secici: string }[]
  hataOlmamali: { secici: string; neden: string }[]
}

const expected = JSON.parse(readFileSync(path.join(FIXTURES, 'beklenen.json'), 'utf8')) as Expected
let browser: Browser
let det: DeterministicRaw

beforeAll(async () => {
  browser = await Browser.launch()
  await browser.page.open(fixtureUrl('bilinen-hatalar.html'))
  det = await browser.page.evaluate<DeterministicRaw>('globalThis.__uxDoctor.runDeterministic()')
})

afterAll(async () => {
  await browser?.close()
})

describe('bilinen-hatalar.html', () => {
  it.each(expected.hatalar.map((h) => [h.id, h] as const))('%s yakalanır', (_id, h) => {
    const match = det.findings.find((f) => f.ruleId === h.kural && f.selector === h.secici)
    expect(match, `${h.hata}: ${h.kural} @ ${h.secici}`).toBeDefined()
    expect(match!.rule).toContain(h.wcag)
    expect(match!.category).toBe(h.kategori)
    expect(categoryForRule(h.kural)).toBe(h.kategori)
    // Bulgu Türkçe ve öneri boş değil (3. madde).
    expect(match!.fix.length).toBeGreaterThan(20)
    expect(match!.fix).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
  })

  it.each(expected.hataOlmamali.map((k) => [k.secici, k] as const))('%s için yanlış alarm yok', (secici) => {
    expect(det.findings.filter((f) => f.selector === secici)).toEqual([])
  })

  it('beklenmeyen ek bulgu yok (yakalanan = beklenen)', () => {
    const got = det.findings.map((f) => `${f.ruleId} @ ${f.selector}`).sort()
    const want = expected.hatalar.map((h) => `${h.kural} @ ${h.secici}`).sort()
    expect(got).toEqual(want)
  })
})
