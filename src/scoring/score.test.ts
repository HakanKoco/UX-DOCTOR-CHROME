import { describe, expect, it } from 'vitest'
import type { DeterministicCategoryId, Finding, RubricAnswerResult, Severity } from '@/shared/report'
import { RUBRIC } from '@/shared/rubric'
import { combineScores, round1, scoreDeterministic, scoreLlm, weightedAverage } from './score'
import { DETERMINISTIC_CATEGORY_WEIGHTS, LAYER_WEIGHTS, PRINCIPLE_WEIGHTS } from './weights'

function detFinding(category: DeterministicCategoryId, severity: Severity): Finding {
  return {
    id: 'x',
    source: 'deterministic',
    selector: 'p',
    rule: 'WCAG',
    ruleId: 'r',
    category,
    severity,
    description: '',
    fix: '',
    evidence: { highlightable: true },
  }
}

const zeroPasses: Record<DeterministicCategoryId, number> = {
  contrast: 0,
  'text-alternatives': 0,
  'form-labels': 0,
  'target-size': 0,
  language: 0,
  'other-wcag': 0,
}

function ans(questionId: string, effectiveAnswer: RubricAnswerResult['effectiveAnswer']): RubricAnswerResult {
  const q = RUBRIC.find((r) => r.id === questionId)!
  return {
    questionId,
    principle: q.principle,
    rawAnswer: effectiveAnswer,
    effectiveAnswer,
    evidenceIds: [],
    invalidEvidenceIds: [],
    rationale: '',
    fix: '',
  }
}

describe('ağırlıklar', () => {
  it('kategori, ilke ve katman ağırlıklarının toplamı 1', () => {
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
    expect(sum(DETERMINISTIC_CATEGORY_WEIGHTS)).toBeCloseTo(1)
    expect(sum(PRINCIPLE_WEIGHTS)).toBeCloseTo(1)
    expect(LAYER_WEIGHTS.deterministic + LAYER_WEIGHTS.llm).toBeCloseTo(1)
  })
})

describe('weightedAverage', () => {
  it('null alt skorları dışarıda bırakıp ağırlıkları yeniden ölçekler', () => {
    expect(weightedAverage([{ score: 80, weight: 0.5 }, { score: null, weight: 0.5 }])).toBe(80)
    expect(weightedAverage([{ score: 100, weight: 0.25 }, { score: 0, weight: 0.75 }])).toBe(25)
  })
  it('hiç skor yoksa null', () => {
    expect(weightedAverage([{ score: null, weight: 1 }])).toBeNull()
  })
})

describe('scoreDeterministic', () => {
  it('S = 100 × P / (P + Σ şiddet ağırlığı)', () => {
    // contrast: 9 geçen, 1 Yüksek (3) ihlal → 100 × 9 / 12 = 75
    const r = scoreDeterministic([detFinding('contrast', 'Yüksek')], { ...zeroPasses, contrast: 9 })
    const c = r.categories.find((x) => x.id === 'contrast')!
    expect(c.score).toBe(75)
    expect(c.detail).toEqual({ passedNodes: 9, violationNodes: 1, weightedViolations: 3 })
  })
  it('öğesi olmayan kategori null olur ve toplamdan çıkar', () => {
    const r = scoreDeterministic([], { ...zeroPasses, contrast: 10 })
    expect(r.categories.find((x) => x.id === 'language')!.score).toBeNull()
    expect(r.score).toBe(100)
  })
  it('geçen öğe yokken ihlal varsa kategori 0 olur', () => {
    const r = scoreDeterministic([detFinding('language', 'Yüksek')], zeroPasses)
    expect(r.categories.find((x) => x.id === 'language')!.score).toBe(0)
  })
  it('toplam, kategori ağırlıklarıyla hesaplanır', () => {
    // contrast 50 (ağırlık .25), form-labels 100 (ağırlık .2) → (12.5 + 20) / .45 = 72.2
    const r = scoreDeterministic([detFinding('contrast', 'Kritik')], { ...zeroPasses, contrast: 4, 'form-labels': 5 })
    expect(r.score).toBe(round1((50 * 0.25 + 100 * 0.2) / 0.45))
  })
  it('LLM bulguları deterministik skoru etkilemez', () => {
    const llmFinding = { ...detFinding('contrast', 'Kritik'), source: 'llm' as const }
    const r = scoreDeterministic([llmFinding], { ...zeroPasses, contrast: 4 })
    expect(r.categories.find((x) => x.id === 'contrast')!.score).toBe(100)
  })
})

describe('scoreLlm', () => {
  it('S = 100 × Σw(evet) / (Σw(evet) + Σw(hayır)); belirsiz hariç', () => {
    // V1 Yüksek(3) evet, V2 Orta(2) hayır, V3 belirsiz → 100 × 3 / 5 = 60
    const r = scoreLlm([ans('V1', 'evet'), ans('V2', 'hayir'), ans('V3', 'belirsiz')])
    const v = r.categories.find((c) => c.id === 'visibility')!
    expect(v.score).toBe(60)
    expect(v.detail).toMatchObject({ yes: 1, no: 1, uncertain: 1 })
  })
  it('cevabı olmayan ilke null', () => {
    const r = scoreLlm([ans('V1', 'evet')])
    expect(r.categories.find((c) => c.id === 'feedback')!.score).toBeNull()
    expect(r.score).toBe(100)
  })
  it('tümü belirsizse katman skoru null', () => {
    expect(scoreLlm([ans('V1', 'belirsiz')]).score).toBeNull()
  })
})

describe('combineScores', () => {
  it('Toplam = 0.6 × deterministik + 0.4 × LLM', () => {
    const det = { score: 80, categories: [] }
    const llm = { score: 50, categories: [] }
    const r = combineScores(det, llm)
    expect(r.overall).toBe(68)
    expect(r.llmIncluded).toBe(true)
  })
  it('LLM yoksa toplam deterministik skordur', () => {
    const r = combineScores({ score: 72.5, categories: [] }, null)
    expect(r.overall).toBe(72.5)
    expect(r.llmIncluded).toBe(false)
  })
})
