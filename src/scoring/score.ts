// Skor hesaplama — saf fonksiyonlar (birim testli). Formülün açıklaması README "Skor formülü" bölümündedir.
import { CATEGORY_LABELS, DETERMINISTIC_CATEGORY_IDS } from '@/shared/axeMapping'
import type {
  CategoryScore,
  DeterministicCategoryId,
  Finding,
  LayerScore,
  ReportScores,
  RubricAnswerResult,
} from '@/shared/report'
import { PRINCIPLE_IDS, PRINCIPLE_LABELS, questionById } from '@/shared/rubric'
import {
  DETERMINISTIC_CATEGORY_WEIGHTS,
  FORMULA_VERSION,
  LAYER_WEIGHTS,
  PRINCIPLE_WEIGHTS,
  SATURATION_K,
  SEVERITY_WEIGHTS,
} from './weights'

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Ağırlıklı ortalama; skoru null olan (uygulanamayan) alt skorlar dışarıda bırakılır ve kalan
 * ağırlıklar yeniden ölçeklenir. Hiç skor yoksa null.
 */
export function weightedAverage(items: readonly { score: number | null; weight: number }[]): number | null {
  const valid = items.filter((i): i is { score: number; weight: number } => i.score !== null && i.weight > 0)
  const totalWeight = valid.reduce((s, i) => s + i.weight, 0)
  if (totalWeight === 0) return null
  return round1(valid.reduce((s, i) => s + i.score * i.weight, 0) / totalWeight)
}

/** Bir kuralın cezası: w(şiddet) · (1 + log₂ n). n: aynı kuralı ihlal eden öğe sayısı (tekrar sönümlenir). */
export function rulePenalty(severityWeight: number, nodeCount: number): number {
  return nodeCount <= 0 ? 0 : severityWeight * (1 + Math.log2(nodeCount))
}

/** Doygunluk eğrisi: 100 · e^(−D / k). D = 0 → 100; D büyüdükçe 0'a yaklaşır, 0-100 dışına çıkamaz. */
export function saturationScore(penalty: number, k = SATURATION_K): number {
  return round1(100 * Math.exp(-Math.max(0, penalty) / k))
}

/** Kategori cezası: kategorideki her ihlal edilen kural için rulePenalty toplamı (kuralın en yüksek şiddetiyle). */
export function categoryPenalty(findings: readonly Finding[]): { penalty: number; rules: number } {
  const byRule = new Map<string, { n: number; w: number }>()
  for (const f of findings) {
    const r = byRule.get(f.ruleId) ?? { n: 0, w: 0 }
    r.n++
    r.w = Math.max(r.w, SEVERITY_WEIGHTS[f.severity])
    byRule.set(f.ruleId, r)
  }
  let penalty = 0
  for (const { n, w } of byRule.values()) penalty += rulePenalty(w, n)
  return { penalty, rules: byRule.size }
}

/**
 * Deterministik skor (skor-v2; README "Skor formülü"):
 *   Kural cezası      p_r = w(şiddet_r) · (1 + log₂ n_r)
 *   Kategori cezası   D_c = Σ_r∈c p_r            Kategori alt skoru  S_c = 100 · e^(−D_c / k)
 *   Toplam ceza       D   = Σ_c α_c · D_c,  α_c = 6 · ağırlık_c   Toplam  S = 100 · e^(−D / k),  k = 25
 * Geçen öğe sayısı skora girmez: skor sayfa büyüklüğünden bağımsızdır. Kategoride hiç denetlenen öğe yoksa
 * (geçen = 0 ve ihlal yok) kategori uygulanamaz (null) ve toplama katkı vermez.
 */
export function scoreDeterministic(
  findings: readonly Finding[],
  passesByCategory: Record<DeterministicCategoryId, number>,
): LayerScore {
  let totalPenalty = 0
  let applicable = 0
  const categories: CategoryScore[] = DETERMINISTIC_CATEGORY_IDS.map((id) => {
    const inCategory = findings.filter((f) => f.source === 'deterministic' && f.category === id)
    const passed = passesByCategory[id] ?? 0
    const { penalty, rules } = categoryPenalty(inCategory)
    const multiplier = DETERMINISTIC_CATEGORY_IDS.length * DETERMINISTIC_CATEGORY_WEIGHTS[id]
    const isApplicable = passed > 0 || inCategory.length > 0
    if (isApplicable) {
      applicable++
      totalPenalty += multiplier * penalty
    }
    return {
      id,
      label: CATEGORY_LABELS[id],
      score: isApplicable ? saturationScore(penalty) : null,
      weight: DETERMINISTIC_CATEGORY_WEIGHTS[id],
      detail: {
        passedNodes: passed,
        violationNodes: inCategory.length,
        violatedRules: rules,
        penalty: Math.round(penalty * 100) / 100,
        multiplier: Math.round(multiplier * 100) / 100,
      },
    }
  })
  return { score: applicable === 0 ? null : saturationScore(totalPenalty), categories, penalty: Math.round(totalPenalty * 100) / 100 }
}

/**
 * Norman ilke skoru (LLM cevaplarından, kod hesaplar):
 *   S_p = 100 × Σ w(evet) / (Σ w(evet) + Σ w(hayır))
 * w: sorunun rubrikteki şiddet ağırlığı. "belirsiz" cevaplar (ve kanıtı geçersiz olduğu için belirsize
 * düşen "hayır"lar) skora girmez. İlkede hiç evet/hayır yoksa null.
 */
export function scoreLlm(answers: readonly RubricAnswerResult[]): LayerScore {
  const categories: CategoryScore[] = PRINCIPLE_IDS.map((id) => {
    const inPrinciple = answers.filter((a) => a.principle === id)
    let weightedYes = 0
    let weightedNo = 0
    let yes = 0
    let no = 0
    let uncertain = 0
    for (const a of inPrinciple) {
      const q = questionById(a.questionId)
      const w = q ? SEVERITY_WEIGHTS[q.severity] : 1
      if (a.effectiveAnswer === 'evet') {
        yes++
        weightedYes += w
      } else if (a.effectiveAnswer === 'hayir') {
        no++
        weightedNo += w
      } else uncertain++
    }
    const denominator = weightedYes + weightedNo
    return {
      id,
      label: PRINCIPLE_LABELS[id],
      score: denominator === 0 ? null : round1((100 * weightedYes) / denominator),
      weight: PRINCIPLE_WEIGHTS[id],
      detail: { yes, no, uncertain, weightedYes, weightedNo },
    }
  })
  return { score: weightedAverage(categories), categories }
}

/** Toplam skor: Toplam = 0.6 × Deterministik + 0.4 × LLM. LLM yoksa toplam = deterministik skor. */
export function combineScores(deterministic: LayerScore, llm: LayerScore | null): ReportScores {
  const llmIncluded = llm !== null && llm.score !== null
  const overall = llmIncluded
    ? weightedAverage([
        { score: deterministic.score, weight: LAYER_WEIGHTS.deterministic },
        { score: llm!.score, weight: LAYER_WEIGHTS.llm },
      ])
    : deterministic.score
  return {
    deterministic,
    llm,
    overall,
    llmIncluded,
    layerWeights: { ...LAYER_WEIGHTS },
    formulaVersion: FORMULA_VERSION,
  }
}
