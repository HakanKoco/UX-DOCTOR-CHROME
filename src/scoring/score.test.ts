import { describe, expect, it } from 'vitest'
import type { DeterministicCategoryId, Finding, RubricAnswerResult, Severity } from '@/shared/report'
import { RUBRIC } from '@/shared/rubric'
import { combineScores, round1, rulePenalty, ruleTerm, saturationScore, scoreDeterministic, scoreLlm, weightedAverage } from './score'
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

describe('scoreDeterministic (skor-v3: ½ kategori geometrik ortalaması + ½ benzersiz kural terimi)', () => {
  const many = (category: DeterministicCategoryId, severity: Severity, ruleId: string, n: number) =>
    Array.from({ length: n }, () => detFinding(category, severity, ruleId))
  const passes = (scale: number) => ({
    contrast: 300 * scale,
    'text-alternatives': 40 * scale,
    'form-labels': 10 * scale,
    'target-size': 200 * scale,
    language: 1,
    'other-wcag': 1500 * scale,
  })
  const score = (findings: Finding[], scale = 1) => scoreDeterministic(findings, passes(scale)).score!
  const fiveHighRules = () => [
    detFinding('contrast', 'Yüksek', 'color-contrast'),
    detFinding('target-size', 'Yüksek', 'target-size'),
    detFinding('language', 'Yüksek', 'html-has-lang'),
    detFinding('other-wcag', 'Yüksek', 'link-name'),
    detFinding('other-wcag', 'Yüksek', 'list'),
  ]

  it('ihlalsiz sayfa = 100', () => {
    expect(scoreDeterministic([], passes(1)).score).toBe(100)
  })

  it('tek Kritik ihlal belirgin ama felaket olmayan bir düşüş yapar (80-95 arası)', () => {
    // Kategori yarısı: 100·e^(−0,2·4/25) = 96.9; kural yarısı: 100·e^(−4/20) = 81.9 → 89.4
    const s = score([detFinding('form-labels', 'Kritik', 'label')])
    expect(s).toBe(89.4)
    expect(s).toBeGreaterThan(80)
    expect(s).toBeLessThan(95)
  })

  it('5 farklı Yüksek kural makul bir düşüş yapar (55-85 arası) ve tek Kritik ihlalden düşüktür', () => {
    const s = score(fiveHighRules())
    expect(s).toBeGreaterThan(55)
    expect(s).toBeLessThan(85)
    expect(s).toBeLessThan(score([detFinding('form-labels', 'Kritik', 'label')]))
  })

  it('aynı ihlaller 10 kat (ve 1000 kat) büyük sayfada aynı skoru verir (geçen öğe sayısı skora girmez)', () => {
    const findings = [...fiveHighRules(), ...many('text-alternatives', 'Kritik', 'image-alt', 12)]
    expect(score(findings, 10)).toBe(score(findings, 1))
    expect(score(findings, 1000)).toBe(score(findings, 1))
  })

  it('skor her durumda 0-100 aralığında kalır', () => {
    const severities: Severity[] = ['Kritik', 'Yüksek', 'Orta', 'Düşük']
    for (const sev of severities) {
      for (const n of [1, 2, 10, 100, 1000]) {
        for (const rules of [1, 3, 10]) {
          const findings = Array.from({ length: rules }, (_, i) => many('other-wcag', sev, `r${i}`, n)).flat()
          const r = scoreDeterministic(findings, passes(1))
          expect(r.score!).toBeGreaterThanOrEqual(0)
          expect(r.score!).toBeLessThanOrEqual(100)
          for (const c of r.categories) if (c.score !== null) expect(c.score).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('1000 Kritik ihlalde bile 0-100 aralığında kalır; ihlal arttıkça skor azalır', () => {
    const one = score(many('text-alternatives', 'Kritik', 'image-alt', 1))
    const thousand = score(many('text-alternatives', 'Kritik', 'image-alt', 1000))
    const huge = score([
      ...many('text-alternatives', 'Kritik', 'image-alt', 1000),
      ...many('form-labels', 'Kritik', 'label', 1000),
      ...many('other-wcag', 'Kritik', 'button-name', 1000),
      ...many('contrast', 'Yüksek', 'color-contrast', 1000),
    ])
    for (const s of [one, thousand, huge]) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
    expect(one).toBeGreaterThan(thousand)
    expect(thousand).toBeGreaterThan(huge)
  })

  it('öğe sayısı yalnızca kategori yarısını etkiler: kural yarısı 1 ve 1000 öğede aynıdır', () => {
    const r1 = scoreDeterministic(many('text-alternatives', 'Kritik', 'image-alt', 1), passes(1))
    const r1000 = scoreDeterministic(many('text-alternatives', 'Kritik', 'image-alt', 1000), passes(1))
    expect(r1.components!.ruleScore).toBe(r1000.components!.ruleScore)
    expect(r1.components!.ruleWeightSum).toBe(4)
    expect(r1000.components!.categoryScore).toBeLessThan(r1.components!.categoryScore)
    expect(ruleTerm(many('contrast', 'Yüksek', 'color-contrast', 50)).ruleWeightSum).toBe(3)
  })

  it('5 farklı Yüksek kural, aynı kuralda 5 öğeden ağırdır', () => {
    const sameRule = score(many('other-wcag', 'Yüksek', 'r1', 5))
    const fiveRules = score(['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => detFinding('other-wcag', 'Yüksek', id)))
    expect(fiveRules).toBeLessThan(sameRule)
  })

  it('kural cezası ve kural terimi kuralın en yüksek şiddetiyle hesaplanır', () => {
    expect(rulePenalty(SEVERITY_WEIGHTS.Kritik, 1)).toBe(4)
    expect(rulePenalty(3, 4)).toBe(9)
    expect(rulePenalty(3, 0)).toBe(0)
    const mixed = scoreDeterministic([detFinding('contrast', 'Düşük', 'c'), detFinding('contrast', 'Kritik', 'c')], passes(1))
    expect(mixed.categories.find((c) => c.id === 'contrast')!.detail.penalty).toBe(round1(4 * 2))
    expect(mixed.components!.ruleWeightSum).toBe(4)
  })

  it('kategori ağırlığı geometrik ortalamada üstür: aynı ihlal kontrastta hedef boyutundan ağır basar', () => {
    const inContrast = score([detFinding('contrast', 'Yüksek', 'x')])
    const inTarget = score([detFinding('target-size', 'Yüksek', 'x')])
    expect(inContrast).toBeLessThan(inTarget)
    expect(saturationScore(0)).toBe(100)
    expect(saturationScore(SATURATION_K)).toBe(36.8)
  })

  it('saglik.org.tr raporundaki kural profili (2026-10-06): skor-v2 11.5 → skor-v3 55.2', () => {
    // Kural × öğe × şiddet, gerçek rapordan: color-contrast Yüksek×19, image-alt Kritik×1, label Kritik×1,
    // aria-allowed-attr Kritik×5, link-name Yüksek×5. Formülün README tablosundaki değeri ürettiğini sınar.
    const findings = [
      ...many('contrast', 'Yüksek', 'color-contrast', 19),
      ...many('text-alternatives', 'Kritik', 'image-alt', 1),
      ...many('form-labels', 'Kritik', 'label', 1),
      ...many('other-wcag', 'Kritik', 'aria-allowed-attr', 5),
      ...many('other-wcag', 'Yüksek', 'link-name', 5),
    ]
    const r = scoreDeterministic(findings, passes(1))
    expect(r.score).toBe(55.2)
    expect(r.components).toMatchObject({ categoryScore: 69.7, ruleScore: 40.7, ruleWeightSum: 18, violatedRules: 5 })
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

describe('scoreLlm (A2 kapsam eşiği + bilgi amaçlı katı skor)', () => {
  it('S = 100 × Σw(evet) / (Σw(evet) + Σw(hayır)); belirsiz hariç', () => {
    // V1 Yüksek(3) evet, V2 Orta(2) hayır, V3 Yüksek(3) evet, V4 belirsiz → 100 × 6 / 8 = 75
    const r = scoreLlm([ans('V1', 'evet'), ans('V2', 'hayir'), ans('V3', 'evet'), ans('V4', 'belirsiz')])
    const v = r.categories.find((c) => c.id === 'visibility')!
    expect(v.score).toBe(75)
    expect(v.detail).toMatchObject({ yes: 2, no: 1, uncertain: 1, answered: 3, questions: 5, insufficientCoverage: 0 })
  })

  it('3 sorudan azı yanıtlanan ilke "yetersiz kapsam" olur ve ortalamaya girmez', () => {
    const r = scoreLlm([
      ans('V1', 'evet'),
      ans('V2', 'hayir'),
      ans('V3', 'evet'),
      ans('F1', 'evet'),
      ans('F2', 'belirsiz'),
      ans('F3', 'belirsiz'),
    ])
    const f = r.categories.find((c) => c.id === 'feedback')!
    expect(f.score).toBeNull()
    expect(f.detail.insufficientCoverage).toBe(1)
    // Tek "evet" Geri Bildirim'e 100 verip ortalamayı yükseltemez: LLM skoru yalnızca Görünürlük'tür.
    expect(r.score).toBe(75)
    expect(r.coverage).toMatchObject({ answered: 4, questions: 29, minAnsweredPerPrinciple: 3 })
    expect(r.coverage!.insufficientPrinciples).toContain('feedback')
  })

  it('cevabı olmayan ilke null; hiçbir ilke eşiği geçmezse katman skoru null', () => {
    const r = scoreLlm([ans('V1', 'evet')])
    expect(r.categories.find((c) => c.id === 'feedback')!.score).toBeNull()
    expect(r.score).toBeNull()
    expect(scoreLlm([ans('V1', 'belirsiz')]).score).toBeNull()
  })

  it('kanıtsız ve halüsinasyonlu "hayır" ayrı sayılır; resmi skoru değiştirmez, katı skoru düşürür', () => {
    const evidenceless = { ...ans('V4', 'belirsiz'), rawAnswer: 'hayir' as const }
    const hallucinated = { ...ans('V5', 'belirsiz'), rawAnswer: 'hayir' as const, invalidEvidenceIds: ['E999'] }
    const base = [ans('V1', 'evet'), ans('V2', 'evet'), ans('V3', 'evet')]
    const r = scoreLlm([...base, evidenceless, hallucinated])
    const v = r.categories.find((c) => c.id === 'visibility')!
    expect(v.detail).toMatchObject({ evidencelessNo: 1, hallucinatedNo: 1, uncertain: 2 })
    expect(r.score).toBe(scoreLlm(base).score)
    expect(r.score).toBe(100)
    // Katı: V4 Yüksek(3) ve V5 Orta(2) "hayır" sayılır → 100 × 8 / 13 = 61.5
    expect(r.strictScore).toBe(61.5)
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
