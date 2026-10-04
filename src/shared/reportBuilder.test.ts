import { describe, expect, it } from 'vitest'
import type { DeterministicRaw, PageInfo } from './contentApi'
import { buildLlmRequest } from './llmRequest'
import { evaluateAnswers } from './llmValidate'
import { REPORT_SCHEMA_VERSION, validateReport, type LlmResult } from './report'
import { buildReport, slugForFile, timestampForFile } from './reportBuilder'
import { RUBRIC } from './rubric'
import { sampleInventory } from './testFixtures'

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

describe('validateReport (teslim-kontrol için çalışma zamanı şeması)', () => {
  // Kurgulanmış girdiler; gerçek ölçüm değildir.
  const inv = sampleInventory()
  const answers = RUBRIC.map((q, i) => ({
    questionId: q.id,
    answer: (i === 0 ? 'hayir' : 'evet') as 'hayir' | 'evet',
    evidenceIds: i === 0 ? ['E2'] : [],
    rationale: 'r',
    fix: '',
  }))
  const llm: LlmResult = {
    run: {
      runId: 'r1',
      timestamp: '2026-10-04T10:00:00.000Z',
      provider: 'gemini',
      requestedModel: 'gemini-3.5-flash-lite',
      servedModel: 'gemini-3.5-flash-lite',
      fallbackUsed: false,
      promptVersion: 'norman-rubrik-v1',
      parameters: { maxTokens: 16000, temperature: 1, thinkingLevel: 'MEDIUM' },
      retries: 2,
      manualFallback: { fromModel: 'gemini-3.8-flash', reason: '503' },
      stopReason: 'STOP',
      durationMs: 1,
      usage: null,
      rawResponse: '{}',
    },
    inventory: { includedCount: 4, candidateCount: 4, truncated: false, limit: 200 },
    ...evaluateAnswers(answers, inv),
  }
  const detWithFinding: DeterministicRaw = {
    ...det,
    findings: [
      {
        id: 'd1',
        source: 'deterministic',
        selector: '#logo',
        rule: 'WCAG 1.1.1',
        ruleId: 'image-alt',
        category: 'text-alternatives',
        severity: 'Kritik',
        description: 'Görselin alt metni yok.',
        fix: 'Alt metin ekleyin.',
        evidence: { highlightable: true },
      },
    ],
  }
  const full = () =>
    buildReport({
      toolVersion: '1.0.0',
      page,
      privacy: { level: 'safe', sensitive: false, reasons: [], strongReasons: [], weakReasons: [], consentGiven: false },
      det: detWithFinding,
      llm,
      llmRequest: buildLlmRequest('gemini-3.5-flash-lite', inv),
    })

  it('buildReport çıktısı (deterministik + LLM bulgulu, elle yedek model notlu) şemadan geçer; JSON gidiş-dönüşünde de', () => {
    const r = full()
    expect(llm.findings.length).toBeGreaterThan(0)
    expect(validateReport(r)).toEqual([])
    expect(validateReport(JSON.parse(JSON.stringify(r)))).toEqual([])
  })

  it('bozuk raporda hatanın yolunu söyler', () => {
    const r = JSON.parse(JSON.stringify(full()))
    r.deterministic.findings[0].severity = 'Çok yüksek'
    r.scores.overall = 140
    delete r.llm.run.servedModel
    const errors = validateReport(r)
    expect(errors).toContain('deterministic.findings[0].severity: geçersiz (Çok yüksek)')
    expect(errors).toContain('scores.overall: 0-100 ya da null değil')
    expect(errors).toContain('llm.run.servedModel: metin değil')
    expect(validateReport([])).toEqual(['kök: nesne değil'])
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
