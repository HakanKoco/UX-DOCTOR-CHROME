// LLM yanıtının doğrulanması (saf fonksiyonlar, birim testli).
// - Envanterde olmayan bir kimliğe atıf otomatik halüsinasyon sayılır: kanıttan düşülür ve sayılır.
// - Geçerli kanıtı kalmayan "hayir" cevabı bulgu üretmez ve skorda "belirsiz" sayılır (kanıtsız bulgu, bulgu değildir).
import { PAGE_EVIDENCE_ID, type Inventory } from './inventory'
import type { Finding, HallucinationStats, RubricAnswerResult, RubricAnswerValue } from './report'
import { PRINCIPLE_LABELS, RUBRIC, questionById } from './rubric'

export interface RawAnswer {
  questionId: string
  answer: RubricAnswerValue
  evidenceIds: string[]
  rationale: string
  fix: string
}

export class LlmResponseError extends Error {}

const ANSWERS = new Set<RubricAnswerValue>(['evet', 'hayir', 'belirsiz'])

/** Ham yanıt metnini ayrıştırır ve yapısını denetler. Şema API tarafından zorlansa da istemci yine doğrular. */
export function parseLlmResponse(text: string): RawAnswer[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new LlmResponseError('LLM yanıtı geçerli JSON değil.')
  }
  const answers = (data as { answers?: unknown })?.answers
  if (!Array.isArray(answers)) throw new LlmResponseError('LLM yanıtında "answers" dizisi yok.')
  return answers.map((a, i) => {
    const item = a as Partial<RawAnswer>
    if (typeof item.questionId !== 'string' || !ANSWERS.has(item.answer as RubricAnswerValue)) {
      throw new LlmResponseError(`LLM yanıtındaki ${i + 1}. cevap şemaya uymuyor.`)
    }
    return {
      questionId: item.questionId,
      answer: item.answer as RubricAnswerValue,
      evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds.filter((x): x is string => typeof x === 'string') : [],
      rationale: typeof item.rationale === 'string' ? item.rationale : '',
      fix: typeof item.fix === 'string' ? item.fix : '',
    }
  })
}

export interface EvaluatedAnswers {
  answers: RubricAnswerResult[]
  findings: Finding[]
  hallucination: HallucinationStats
  missingQuestionIds: string[]
  ignoredAnswers: number
}

/**
 * Cevapları envantere karşı doğrular ve bulguları üretir.
 * @param inventory Yerel (maskelenmemiş seçicili) envanter; kimlik → seçici eşlemesi buradan alınır.
 */
export function evaluateAnswers(raw: RawAnswer[], inventory: Inventory): EvaluatedAnswers {
  const byId = new Map(inventory.elements.map((e) => [e.id, e]))
  const seen = new Set<string>()
  const answers: RubricAnswerResult[] = []
  const findings: Finding[] = []
  const invalidIds = new Set<string>()
  let totalReferences = 0
  let invalidReferences = 0
  let droppedFindings = 0
  let evidencelessNegatives = 0
  let ignoredAnswers = 0

  for (const item of raw) {
    const question = questionById(item.questionId)
    if (!question || seen.has(item.questionId)) {
      ignoredAnswers++
      continue
    }
    seen.add(item.questionId)

    const ids = [...new Set(item.evidenceIds.map((id) => id.trim()).filter(Boolean))]
    const valid: string[] = []
    const invalid: string[] = []
    for (const id of ids) {
      totalReferences++
      if (id === PAGE_EVIDENCE_ID || byId.has(id)) valid.push(id)
      else {
        invalid.push(id)
        invalidIds.add(id)
        invalidReferences++
      }
    }

    let effective: RubricAnswerValue = item.answer
    if (item.answer === 'hayir' && valid.length === 0) {
      effective = 'belirsiz'
      if (invalid.length > 0) droppedFindings++
      else evidencelessNegatives++
    }

    answers.push({
      questionId: question.id,
      principle: question.principle,
      rawAnswer: item.answer,
      effectiveAnswer: effective,
      evidenceIds: valid,
      invalidEvidenceIds: invalid,
      rationale: item.rationale,
      fix: item.fix,
    })

    if (effective === 'hayir') {
      const elementIds = valid.filter((id) => id !== PAGE_EVIDENCE_ID)
      const primaryId = elementIds[0] ?? PAGE_EVIDENCE_ID
      const primary = byId.get(primaryId)
      findings.push({
        id: `L-${question.id}`,
        source: 'llm',
        selector: primary?.selector ?? 'body',
        elementId: primaryId,
        rule: `Norman: ${PRINCIPLE_LABELS[question.principle]}`,
        ruleId: question.id,
        category: question.principle,
        severity: question.severity,
        description: `${question.question} → Hayır. ${item.rationale}`.trim(),
        fix: item.fix.trim() || 'Gerekçede belirtilen sorunu giderin.',
        evidence: {
          highlightable: true,
          relatedElements: elementIds.slice(1).map((id) => ({ elementId: id, selector: byId.get(id)!.selector })),
        },
      })
    }
  }

  const missingQuestionIds = RUBRIC.filter((q) => !seen.has(q.id)).map((q) => q.id)
  return {
    answers,
    findings,
    hallucination: {
      totalReferences,
      invalidReferences,
      droppedFindings,
      evidencelessNegatives,
      invalidReferenceRate: totalReferences > 0 ? invalidReferences / totalReferences : null,
      invalidIds: [...invalidIds],
    },
    missingQuestionIds,
    ignoredAnswers,
  }
}
