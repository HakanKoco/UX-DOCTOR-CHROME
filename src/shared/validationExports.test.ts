import { describe, expect, it } from 'vitest'
import type { PageInfo } from './contentApi'
import { buildLlmRequest } from './llmRequest'
import { evaluateAnswers, type RawAnswer } from './llmValidate'
import type { LlmResult } from './report'
import { RUBRIC } from './rubric'
import { sampleInventory } from './testFixtures'
import { MAX_RETRIES } from './retry'
import { buildConsistencyExport, buildHallucinationReview } from './validationExports'

// Bu testlerdeki "çalıştırmalar" birim testi için kurgulanmış girdilerdir; gerçek ölçüm değildir.

const page: PageInfo = { url: 'https://ornek.test/', host: 'ornek.test', title: 'Örnek', lang: 'tr', viewport: { width: 1, height: 1 }, translation: { detected: false, reasons: [] } }

function fakeResult(answers: RawAnswer[], runId: string): LlmResult {
  const inv = sampleInventory()
  const ev = evaluateAnswers(answers, inv)
  return {
    run: {
      runId,
      timestamp: '2026-10-03T10:00:00.000Z',
      provider: 'claude',
      requestedModel: 'claude-opus-5-5',
      servedModel: 'claude-opus-5-5',
      fallbackUsed: false,
      promptVersion: 'norman-rubrik-v1',
      parameters: { maxTokens: 16000, effort: 'medium' },
      retries: 0,
      stopReason: 'end_turn',
      durationMs: 1,
      usage: null,
      rawResponse: '{}',
    },
    inventory: { includedCount: 4, candidateCount: 4, truncated: false, limit: 200 },
    ...ev,
  }
}

function allAnswers(override: Record<string, RawAnswer['answer']>): RawAnswer[] {
  return RUBRIC.map((q) => ({
    questionId: q.id,
    answer: override[q.id] ?? 'evet',
    evidenceIds: override[q.id] === 'hayir' ? ['E2'] : [],
    rationale: 'r',
    fix: '',
  }))
}

describe('buildConsistencyExport', () => {
  it('ilke başına istatistik, eşik ve soru uyumu üretir', () => {
    const inv = sampleInventory()
    const results = [
      { runIndex: 1, result: fakeResult(allAnswers({}), 'a') },
      { runIndex: 2, result: fakeResult(allAnswers({ V1: 'hayir' }), 'b') },
      { runIndex: 3, result: fakeResult(allAnswers({}), 'c') },
    ]
    const ex = buildConsistencyExport({
      page,
      request: buildLlmRequest('claude-opus-5-5', inv),
      inventory: inv,
      requestedRuns: 3,
      results,
      failures: [],
    })
    expect(ex.completedRuns).toBe(3)
    expect(ex.stats.principles.feedback).toMatchObject({ n: 3, mean: 100, range: 0 })
    // V1 (Yüksek=3) hayır olduğunda görünürlük: Σw(evet) = V2..V5 = 2+3+3+2 = 10 → 100·10/13 = 76.9
    expect(ex.stats.principles.visibility).toMatchObject({ min: 76.9, max: 100, range: 23.1 })
    expect(ex.stats.exceedsThreshold).toBe(true)
    expect(ex.questionAgreement.find((q) => q.questionId === 'V1')).toMatchObject({ modeAnswer: 'evet' })
    expect(ex.runs.map((r) => r.rawResponse)).toHaveLength(3)
  })
})

describe('buildHallucinationReview', () => {
  it('her LLM bulgusu için "gerçek mi?" alanı boş bırakılır', () => {
    const llm = fakeResult(allAnswers({ M1: 'hayir', V4: 'hayir' }), 'x')
    llm.answers[0].invalidEvidenceIds = ['E99']
    const ex = buildHallucinationReview({ page, llm, inventory: sampleInventory() })
    expect(ex.items).toHaveLength(2)
    for (const item of ex.items) {
      expect(item.gercekMi).toBeNull()
      expect(item.not).toBe('')
      expect(item.autoCheck.idInInventory).toBe(true)
      expect(item.autoCheck.selectorFoundOnPage).toBeNull()
    }
    expect(ex.items[0].element).toMatchObject({ tag: 'button', role: 'button' })
    expect(ex.droppedReferences).toEqual([{ questionId: 'V1', invalidIds: ['E99'] }])
  })
})

describe('buildConsistencyExport — Gemini', () => {
  it('sağlayıcı, parametreler ve bekleme kuralı kaydedilir', () => {
    const inv = sampleInventory()
    const result = fakeResult(allAnswers({}), 'g')
    result.run = { ...result.run, provider: 'gemini', requestedModel: 'gemini-3.8-flash', servedModel: 'gemini-3.8-flash', retries: 2 }
    const ex = buildConsistencyExport({
      page,
      request: buildLlmRequest('gemini-3.8-flash', inv),
      inventory: inv,
      requestedRuns: 3,
      results: [{ runIndex: 1, result }],
      failures: [{ runIndex: 2, timestamp: '2026-10-03T10:00:00.000Z', error: 'İstek sınırına takıldınız (429).' }],
    })
    expect(ex.provider).toBe('gemini')
    expect(ex.requestedModel).toBe('gemini-3.8-flash')
    expect(ex.parameters).toEqual({ maxTokens: 16000, temperature: 1, thinkingLevel: 'MEDIUM' })
    expect(ex.pacing).toEqual({ runIntervalMs: 15000, maxRetries: MAX_RETRIES })
    expect(ex.runs[0]).toMatchObject({ provider: 'gemini', retries: 2 })
    expect(ex.requestBody).toHaveProperty('generationConfig')
  })

  it('halüsinasyon listesine sağlayıcı yazılır', () => {
    const llm = fakeResult(allAnswers({ M1: 'hayir' }), 'y')
    llm.run = { ...llm.run, provider: 'gemini' }
    expect(buildHallucinationReview({ page, llm, inventory: sampleInventory() }).provider).toBe('gemini')
  })
})
