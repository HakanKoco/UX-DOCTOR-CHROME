import { describe, expect, it } from 'vitest'
import type { DeterministicCategoryId, Finding, RubricAnswerResult, Severity } from '@/shared/report'
import { RUBRIC } from '@/shared/rubric'
import { combineScores, round1, rulePenalty, saturationScore, scoreDeterministic, scoreLlm, weightedAverage } from './score'
import { DETERMINISTIC_CATEGORY_WEIGHTS, LAYER_WEIGHTS, PRINCIPLE_WEIGHTS, SATURATION_K, SEVERITY_WEIGHTS } from './weights'

function detFinding(category: DeterministicCategoryId, severity: Severity, ruleId = 'r'): Finding {
  return {
    id: 'x',
    source: 'deterministic',
    selector: 'p',
    rule: 'WCAG',
    ruleId,
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

describe('scoreDeterministic (skor-v2: şiddet ağırlıklı doygunluk eğrisi, k = 25)', () => {
  const many = (category: DeterministicCategoryId, severity: Severity, ruleId: string, n: number) =>
    Array.from({ length: n }, () => detFinding(category, severity, ruleId))
  const samsun = () => many('target-size', 'Yüksek', 'target-size', 5)
  const passes = (scale: number) => ({
    contrast: 300 * scale,
    'text-alternatives': 40 * scale,
    'form-labels': 10 * scale,
    'target-size': 200 * scale,
    language: 1,
    'other-wcag': 1500 * scale,
  })

  it('(a) ihlalsiz sayfa = 100', () => {
    expect(scoreDeterministic([], passes(1)).score).toBe(100)
  })

  it('(b) 5 Yüksek dokunma hedefi ihlali belirgin biçimde düşük (samsun.edu.tr gözlemi: eski formülde 99.0)', () => {
    const r = scoreDeterministic(samsun(), passes(1))
    // p = 3 · (1 + log₂5) = 9.966; α(target-size) = 6 · 0.1 = 0.6 → D = 5.98 → 100 · e^(−5.98/25) = 78.7
    expect(r.score).toBe(78.7)
    expect(r.score!).toBeLessThan(85)
    const ts = r.categories.find((c) => c.id === 'target-size')!
    expect(ts.score).toBe(67.1)
    expect(ts.detail).toMatchObject({ violationNodes: 5, violatedRules: 1, penalty: 9.97, multiplier: 0.6 })
  })

  it('(c) aynı ihlaller 10 kat büyük sayfada aynı skoru verir (sayfa büyüklüğünden bağımsız)', () => {
    expect(scoreDeterministic(samsun(), passes(10)).score).toBe(scoreDeterministic(samsun(), passes(1)).score)
    expect(scoreDeterministic(samsun(), passes(1000)).score).toBe(78.7)
  })

  it('(d) çok sayıda Kritik ihlalde bile 0-100 aralığında kalır; ihlal arttıkça skor azalır', () => {
    const huge = [
      ...many('text-alternatives', 'Kritik', 'image-alt', 1000),
      ...many('form-labels', 'Kritik', 'label', 1000),
      ...many('other-wcag', 'Kritik', 'button-name', 1000),
      ...many('contrast', 'Yüksek', 'color-contrast', 1000),
    ]
    const r = scoreDeterministic(huge, passes(1))
    expect(r.score!).toBeGreaterThanOrEqual(0)
    expect(r.score!).toBeLessThan(1)
    for (const c of r.categories) if (c.score !== null) expect(c.score).toBeGreaterThanOrEqual(0)
    const s1 = scoreDeterministic(many('contrast', 'Orta', 'color-contrast', 1), passes(1)).score!
    const s2 = scoreDeterministic(many('contrast', 'Orta', 'color-contrast', 4), passes(1)).score!
    const s3 = scoreDeterministic([...many('contrast', 'Orta', 'color-contrast', 4), ...many('contrast', 'Kritik', 'link-in-text-block', 1)], passes(1)).score!
    expect(s1).toBeGreaterThan(s2)
    expect(s2).toBeGreaterThan(s3)
    expect(s1).toBeLessThanOrEqual(100)
  })

  it('aynı kuralın tekrarı log₂ ile sönümlenir: 5 farklı Yüksek kural, aynı kuralda 5 öğeden ağırdır', () => {
    const sameRule = scoreDeterministic(many('other-wcag', 'Yüksek', 'r1', 5), passes(1)).score!
    const fiveRules = scoreDeterministic(
      ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => detFinding('other-wcag', 'Yüksek', id)),
      passes(1),
    ).score!
    expect(fiveRules).toBeLessThan(sameRule)
  })

  it('kural cezası kuralın en yüksek şiddetiyle hesaplanır', () => {
    expect(rulePenalty(SEVERITY_WEIGHTS.Kritik, 1)).toBe(4)
    expect(rulePenalty(3, 4)).toBe(9)
    expect(rulePenalty(3, 0)).toBe(0)
    const mixed = scoreDeterministic([detFinding('contrast', 'Düşük', 'c'), detFinding('contrast', 'Kritik', 'c')], passes(1))
    expect(mixed.categories.find((c) => c.id === 'contrast')!.detail.penalty).toBe(round1(4 * 2))
  })

  it('kategori ağırlığı ceza çarpanıdır (ortalama değil): aynı ihlal kontrastta hedef boyutundan ağır basar', () => {
    const inContrast = scoreDeterministic([detFinding('contrast', 'Yüksek', 'x')], passes(1)).score!
    const inTarget = scoreDeterministic([detFinding('target-size', 'Yüksek', 'x')], passes(1)).score!
    expect(inContrast).toBeLessThan(inTarget)
    expect(saturationScore(0)).toBe(100)
    expect(saturationScore(SATURATION_K)).toBe(36.8)
  })

  it('öğesi olmayan kategori null olur ve toplama katkı vermez', () => {
    const r = scoreDeterministic([], { ...zeroPasses, contrast: 10 })
    expect(r.categories.find((x) => x.id === 'language')!.score).toBeNull()
    expect(r.score).toBe(100)
    expect(scoreDeterministic([], zeroPasses).score).toBeNull()
  })

  it('LLM bulguları deterministik skoru etkilemez', () => {
    const llmFinding = { ...detFinding('contrast', 'Kritik', 'x'), source: 'llm' as const }
    expect(scoreDeterministic([llmFinding], { ...zeroPasses, contrast: 4 }).score).toBe(100)
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
