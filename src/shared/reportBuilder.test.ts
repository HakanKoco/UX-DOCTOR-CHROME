import { describe, expect, it } from 'vitest'
import type { DeterministicRaw, PageInfo } from './contentApi'
import { REPORT_SCHEMA_VERSION } from './report'
import { buildReport, slugForFile, timestampForFile } from './reportBuilder'

const page: PageInfo = {
  url: 'https://www.ornek.gov.tr/hizmetler',
  host: 'www.ornek.gov.tr',
  title: 'Hizmetler',
  lang: 'tr',
  viewport: { width: 1280, height: 800 },
  translation: { detected: false, reasons: [] },
}

const det: DeterministicRaw = {
  engineVersion: '4.13.0',
  tags: ['wcag2a'],
  ranAt: '2026-10-03T10:00:00.000Z',
  findings: [],
  manualReview: [],
  passesByCategory: {
    contrast: 10,
    'text-alternatives': 0,
    'form-labels': 0,
    'target-size': 0,
    language: 1,
    'other-wcag': 5,
  },
}

describe('buildReport', () => {
  it('LLM olmadan rapor kurar; toplam deterministik skordur', () => {
    const r = buildReport({
      toolVersion: '1.0.0',
      page,
      privacy: { level: 'safe', sensitive: false, reasons: [], strongReasons: [], weakReasons: [], consentGiven: false },
      det,
      llm: null,
      llmRequest: null,
    })
    expect(r.schemaVersion).toBe(REPORT_SCHEMA_VERSION)
    expect(r.llm).toBeNull()
    expect(r.scores.llmIncluded).toBe(false)
    expect(r.scores.overall).toBe(100)
    expect(r.llmRequestPreview).toBeUndefined()
  })

  it('hassas sayfa onayı rapora yazılır', () => {
    const r = buildReport({
      toolVersion: '1.0.0',
      page,
      privacy: {
        level: 'sensitive',
        sensitive: true,
        reasons: ['Görünür şifre alanı var (1 adet).'],
        strongReasons: ['Görünür şifre alanı var (1 adet).'],
        weakReasons: [],
        consentGiven: true,
        consentAt: '2026-10-03T10:01:00.000Z',
      },
      det,
      llm: null,
      llmRequest: null,
    })
    expect(r.privacy).toEqual({
      level: 'sensitive',
      sensitive: true,
      reasons: ['Görünür şifre alanı var (1 adet).'],
      strongReasons: ['Görünür şifre alanı var (1 adet).'],
      weakReasons: [],
      consentGiven: true,
      consentAt: '2026-10-03T10:01:00.000Z',
    })
  })
})

describe('dosya adı yardımcıları', () => {
  it('alan adını dosya adına uygun hale getirir', () => {
    expect(slugForFile('www.Örnek.gov.tr')).toBe('www-rnek-gov-tr')
    expect(slugForFile('')).toBe('sayfa')
  })
  it('zaman damgası iki nokta içermez', () => {
    expect(timestampForFile(new Date('2026-10-03T10:20:30.456Z'))).toBe('2026-10-03T10-20-30')
  })
})
