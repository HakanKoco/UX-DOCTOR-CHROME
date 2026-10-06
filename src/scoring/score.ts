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
import { PRINCIPLE_IDS, PRINCIPLE_LABELS, RUBRIC, questionById } from '@/shared/rubric'
import {
  DETERMINISTIC_BLEND,
  DETERMINISTIC_CATEGORY_WEIGHTS,
  FORMULA_VERSION,
  LAYER_WEIGHTS,
  LLM_MIN_ANSWERED_PER_PRINCIPLE,
  PRINCIPLE_WEIGHTS,
  RULE_K,
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

/** Kural başına en yüksek şiddet ağırlığı ve öğe sayısı (ruleId'ye göre). */
function groupByRule(findings: readonly Finding[]): Map<string, { n: number; w: number }> {
  const byRule = new Map<string, { n: number; w: number }>()
  for (const f of findings) {
    const r = byRule.get(f.ruleId) ?? { n: 0, w: 0 }
    r.n++
    r.w = Math.max(r.w, SEVERITY_WEIGHTS[f.severity])
    byRule.set(f.ruleId, r)
  }
  return byRule
}

/** Kategori cezası: kategorideki her ihlal edilen kural için rulePenalty toplamı (kuralın en yüksek şiddetiyle). */
export function categoryPenalty(findings: readonly Finding[]): { penalty: number; rules: number } {
  const byRule = groupByRule(findings)
  let penalty = 0
  for (const { n, w } of byRule.values()) penalty += rulePenalty(w, n)
  return { penalty, rules: byRule.size }
}

/**
 * Kural terimi: 100 · e^(−R / RULE_K). R = ihlal edilen benzersiz kuralların şiddet ağırlıkları toplamı.
 * Öğe sayısı girmez: aynı kuralın 1 ya da 1000 öğede ihlali aynı R'yi verir.
 */
export function ruleTerm(findings: readonly Finding[]): { score: number; ruleWeightSum: number; rules: number } {
  const byRule = groupByRule(findings)
  let ruleWeightSum = 0
  for (const { w } of byRule.values()) ruleWeightSum += w
  return { score: 100 * Math.exp(-ruleWeightSum / RULE_K), ruleWeightSum, rules: byRule.size }
}

/**
 * Deterministik skor (skor-v3; README "Skor formülü"):
 *   Kural cezası       p_r = w(şiddet_r) · (1 + log₂ n_r)
 *   Kategori alt skoru S_c = 100 · e^(−D_c / 25),  D_c = Σ_r∈c p_r
 *   Kategori yarısı    G_kat = 100 · Π_c (S_c / 100)^(ağırlık_c)        (ağırlıklı geometrik ortalama, üsler toplamı 1)
 *   Kural yarısı       T     = 100 · e^(−R / 20),  R = Σ_benzersiz kural w(şiddet_r)
 *   Toplam             S     = ½ · G_kat + ½ · T
 * Geçen öğe sayısı skora girmez: skor sayfa büyüklüğünden bağımsızdır. Kategoride hiç denetlenen öğe yoksa
 * (geçen = 0 ve ihlal yok) kategori uygulanamaz (null); cezası zaten 0 olduğundan geometrik ortalamayı etkilemez.
 */
export function scoreDeterministic(
  findings: readonly Finding[],
  passesByCategory: Record<DeterministicCategoryId, number>,
): LayerScore {
  const deterministic = findings.filter((f) => f.source === 'deterministic')
  // Σ ağırlık_c · D_c; G_kat = 100 · e^(−Σ ağırlık_c · D_c / k) = 100 · Π (S_c/100)^(ağırlık_c)
  let weightedPenalty = 0
  let applicable = 0
  const categories: CategoryScore[] = DETERMINISTIC_CATEGORY_IDS.map((id) => {
    const inCategory = deterministic.filter((f) => f.category === id)
    const passed = passesByCategory[id] ?? 0
    const { penalty, rules } = categoryPenalty(inCategory)
    const weight = DETERMINISTIC_CATEGORY_WEIGHTS[id]
    const isApplicable = passed > 0 || inCategory.length > 0
    if (isApplicable) {
      applicable++
      weightedPenalty += weight * penalty
    }
    return {
      id,
      label: CATEGORY_LABELS[id],
      score: isApplicable ? saturationScore(penalty) : null,
      weight,
      detail: {
        passedNodes: passed,
        violationNodes: inCategory.length,
        violatedRules: rules,
        penalty: Math.round(penalty * 100) / 100,
      },
    }
  })
  if (applicable === 0) return { score: null, categories }
  const categoryPart = 100 * Math.exp(-weightedPenalty / SATURATION_K)
  const rulePart = ruleTerm(deterministic)
  const score = round1(DETERMINISTIC_BLEND.categories * categoryPart + DETERMINISTIC_BLEND.rules * rulePart.score)
  return {
    score,
    categories,
    penalty: Math.round(weightedPenalty * 100) / 100,
    components: {
      categoryScore: round1(categoryPart),
      ruleScore: round1(rulePart.score),
      ruleWeightSum: rulePart.ruleWeightSum,
      violatedRules: rulePart.rules,
    },
  }
}

/** Bir ilkenin rubrikteki soru sayısı (kapsam paydası; LLM'in hiç cevaplamadığı sorular da sayılır). */
function questionCount(principle: string): number {
  return RUBRIC.filter((q) => q.principle === principle).length
}

/** S = 100 × Σw(evet) / (Σw(evet) + Σw(hayır)); yanıtlanan (evet + hayır) soru eşiğin altındaysa null. */
function principleScore(weightedYes: number, weightedNo: number, answered: number): number | null {
  if (answered < LLM_MIN_ANSWERED_PER_PRINCIPLE || weightedYes + weightedNo === 0) return null
  return round1((100 * weightedYes) / (weightedYes + weightedNo))
}

/**
 * Norman ilke skoru (LLM cevaplarından, kod hesaplar; skor-v3):
 *   S_p = 100 × Σ w(evet) / (Σ w(evet) + Σ w(hayır))
 * w: sorunun rubrikteki şiddet ağırlığı. "belirsiz" cevaplar skora girmez. Kanıtı olmadığı ya da envanterde olmayan
 * kimliğe dayandığı için belirsize düşen "hayır"lar resmi skora girmez ama ayrı sayılır (evidencelessNo,
 * hallucinatedNo). Yanıtlanan soru sayısı LLM_MIN_ANSWERED_PER_PRINCIPLE'dan azsa ilke "yetersiz kapsam" olur (null).
 * strictScore yalnızca bilgi amaçlıdır: belirsize düşen "hayır"ları "hayır" sayar.
 */
export function scoreLlm(answers: readonly RubricAnswerResult[]): LayerScore {
  const strictCategories: { score: number | null; weight: number }[] = []
  let answeredTotal = 0
  const insufficientPrinciples: string[] = []
  const categories: CategoryScore[] = PRINCIPLE_IDS.map((id) => {
    const inPrinciple = answers.filter((a) => a.principle === id)
    let weightedYes = 0
    let weightedNo = 0
    let strictWeightedNo = 0
    let yes = 0
    let no = 0
    let uncertain = 0
    let evidencelessNo = 0
    let hallucinatedNo = 0
    for (const a of inPrinciple) {
      const q = questionById(a.questionId)
      const w = q ? SEVERITY_WEIGHTS[q.severity] : 1
      if (a.effectiveAnswer === 'evet') {
        yes++
        weightedYes += w
      } else if (a.effectiveAnswer === 'hayir') {
        no++
        weightedNo += w
        strictWeightedNo += w
      } else {
        uncertain++
        if (a.rawAnswer === 'hayir') {
          strictWeightedNo += w
          if (a.invalidEvidenceIds.length > 0) hallucinatedNo++
          else evidencelessNo++
        }
      }
    }
    const answered = yes + no
    const questions = questionCount(id)
    const score = principleScore(weightedYes, weightedNo, answered)
    const insufficient = score === null && answered < LLM_MIN_ANSWERED_PER_PRINCIPLE
    answeredTotal += answered
    if (insufficient) insufficientPrinciples.push(id)
    strictCategories.push({
      score: principleScore(weightedYes, strictWeightedNo, answered + evidencelessNo + hallucinatedNo),
      weight: PRINCIPLE_WEIGHTS[id],
    })
    return {
      id,
      label: PRINCIPLE_LABELS[id],
      score,
      weight: PRINCIPLE_WEIGHTS[id],
      detail: {
        yes,
        no,
        uncertain,
        weightedYes,
        weightedNo,
        answered,
        questions,
        insufficientCoverage: insufficient ? 1 : 0,
        evidencelessNo,
        hallucinatedNo,
      },
    }
  })
  return {
    score: weightedAverage(categories),
    categories,
    strictScore: weightedAverage(strictCategories),
    coverage: {
      answered: answeredTotal,
      questions: RUBRIC.length,
      minAnsweredPerPrinciple: LLM_MIN_ANSWERED_PER_PRINCIPLE,
      insufficientPrinciples,
    },
  }
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
