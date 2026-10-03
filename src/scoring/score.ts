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

/**
 * Deterministik kategori skoru:
 *   S_c = 100 × P / (P + Σ w(şiddet_i))
 * P: kategorideki kuralları geçen öğe sayısı (axe "passes"), toplam: kategorideki her ihlalli öğe için
 * şiddet ağırlığı. Hiç öğe yoksa (P = 0 ve ihlal yok) kategori uygulanamaz → null.
 */
export function scoreDeterministic(
  findings: readonly Finding[],
  passesByCategory: Record<DeterministicCategoryId, number>,
): LayerScore {
  const categories: CategoryScore[] = DETERMINISTIC_CATEGORY_IDS.map((id) => {
    const inCategory = findings.filter((f) => f.source === 'deterministic' && f.category === id)
    const passed = passesByCategory[id] ?? 0
    const weightedViolations = inCategory.reduce((s, f) => s + SEVERITY_WEIGHTS[f.severity], 0)
    const denominator = passed + weightedViolations
    return {
      id,
      label: CATEGORY_LABELS[id],
      score: denominator === 0 ? null : round1((100 * passed) / denominator),
      weight: DETERMINISTIC_CATEGORY_WEIGHTS[id],
      detail: { passedNodes: passed, violationNodes: inCategory.length, weightedViolations },
    }
  })
  return { score: weightedAverage(categories), categories }
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
