import { describe, expect, it } from 'vitest'
import type { PageInfo } from './contentApi'
import { buildRequestBody } from './llmRequest'
import { evaluateAnswers, type RawAnswer } from './llmValidate'
import type { LlmResult } from './report'
import { RUBRIC } from './rubric'
import { sampleInventory } from './testFixtures'
import { buildConsistencyExport, buildHallucinationReview } from './validationExports'

// Bu testlerdeki "çalıştırmalar" birim testi için kurgulanmış girdilerdir; gerçek ölçüm değildir.

const page: PageInfo = { url: 'https://ornek.test/', host: 'ornek.test', title: 'Örnek', lang: 'tr', viewport: { width: 1, height: 1 } }

function fakeResult(answers: RawAnswer[], runId: string): LlmResult {
  const inv = sampleInventory()
  const ev = evaluateAnswers(answers, inv)
  return {
    run: {
      runId,
      timestamp: '2026-10-03T10:00:00.000Z',
      requestedModel: 'claude-opus-5-5',
      servedModel: 'claude-opus-5-5',
      fallbackUsed: false,
      promptVersion: 'norman-rubrik-v1',
      parameters: { maxTokens: 16000, effort: 'medium' },
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
      body: buildRequestBody('claude-opus-5-5', inv),
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
