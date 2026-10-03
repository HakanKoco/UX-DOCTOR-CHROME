// LLM yanıtının doğrulanması (saf fonksiyonlar, birim testli).
// - Envanterde olmayan bir kimliğe atıf otomatik halüsinasyon sayılır: kanıttan düşülür ve sayılır.
// - Geçerli kanıtı kalmayan "hayir" cevabı bulgu üretmez ve skorda "belirsiz" sayılır (kanıtsız bulgu, bulgu değildir).
import { elementPhrase } from './axeTemplates'
import { PAGE_EVIDENCE_ID, type Inventory, type InventoryElement } from './inventory'
import { maskText } from './masking'
import type { Finding, HallucinationStats, RubricAnswerResult, RubricAnswerValue } from './report'
import { PRINCIPLE_LABELS, RUBRIC, questionById } from './rubric'

export interface RawAnswer {
  questionId: string
  answer: RubricAnswerValue
  evidenceIds: string[]
  rationale: string
  fix: string
}

/** Model yanıtı beklenen şemaya uymadı. Ham yanıt çalıştırma kaydında saklanır; kullanıcı tekrar deneyebilir. */
export class LlmResponseError extends Error {
  constructor(detail: string) {
    super(`Model yanıtı beklenen şemaya uymadı; tekrar deneyin. (${detail})`)
  }
}

const ANSWERS = new Set<RubricAnswerValue>(['evet', 'hayir', 'belirsiz'])

/** "Hayır", "HAYIR", " evet " gibi yazımları şemadaki değere çevirir; tanınmayanlar null. */
export function normalizeAnswer(value: unknown): RubricAnswerValue | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLocaleLowerCase('tr').replace(/ı/g, 'i')
  return ANSWERS.has(v as RubricAnswerValue) ? (v as RubricAnswerValue) : null
}

/**
 * Kanıt kimliğini normalleştirir: yalnızca boşluk kırpma ve büyük harf ("e3 " → "E3", "sayfa" → "SAYFA").
 * Daha esnek eşleştirme (ör. "E3." ya da "öğe 3") yapılmaz: halüsinasyonu gizlerdi.
 */
export function normalizeEvidenceId(value: string): string {
  return value.trim().toLocaleUpperCase('tr')
}

/** Yanıt metninden JSON nesnesini çıkarır: ```json kod bloğu ve öndeki/sondaki açıklama metni temizlenir. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const candidates = [trimmed]
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenced) candidates.push(fenced[1].trim())
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1))
  for (const c of candidates) {
    try {
      return JSON.parse(c)
    } catch {
      // sıradaki aday
    }
  }
  throw new LlmResponseError('yanıt geçerli JSON değil')
}

export interface ParsedLlmResponse {
  answers: RawAnswer[]
  /** Şemaya uymadığı için atlanan cevap sayısı (questionId ya da answer geçersiz). */
  malformed: number
}

/**
 * Ham yanıt metnini ayrıştırır ve yapısını denetler. Şema API tarafından zorlansa da istemci yine doğrular.
 * - Yanıt JSON değilse ya da "answers" dizisi yoksa LlmResponseError (Türkçe; ham yanıt çağıran tarafta saklanır).
 * - Tek tek bozuk cevaplar tüm yanıtı düşürmez: atlanır ve "malformed" olarak sayılır.
 * - Fazladan alanlar yok sayılır; eksik isteğe bağlı alanlar boş değer alır.
 */
export function parseLlmResponse(text: string): ParsedLlmResponse {
  const data = extractJson(text)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new LlmResponseError('yanıt bir JSON nesnesi değil')
  const answers = (data as { answers?: unknown }).answers
  if (!Array.isArray(answers)) throw new LlmResponseError('"answers" dizisi yok')
  const out: RawAnswer[] = []
  let malformed = 0
  for (const a of answers) {
    const item = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
    const answer = normalizeAnswer(item.answer)
    if (typeof item.questionId !== 'string' || !item.questionId.trim() || answer === null) {
      malformed++
      continue
    }
    out.push({
      questionId: item.questionId.trim(),
      answer,
      evidenceIds: Array.isArray(item.evidenceIds)
        ? item.evidenceIds.filter((x): x is string => typeof x === 'string').map(normalizeEvidenceId).filter(Boolean)
        : [],
      rationale: typeof item.rationale === 'string' ? item.rationale.trim() : '',
      fix: typeof item.fix === 'string' ? item.fix.trim() : '',
    })
  }
  if (answers.length > 0 && out.length === 0) throw new LlmResponseError('hiçbir cevap şemaya uymuyor')
  return { answers: out, malformed }
}

const TURKISH_CHARS = /[çğıöşüÇĞİÖŞÜ]/
const ENGLISH_WORDS = /\b(the|and|is|are|should|missing|button|link|page|element|users?|not|has|have|with)\b/i

/** Metin Türkçe değil gibi mi görünüyor (kaba sezgisel: Türkçe harf yok ve yaygın İngilizce sözcük var). */
export function looksNonTurkish(text: string): boolean {
  return text.trim().length > 0 && !TURKISH_CHARS.test(text) && ENGLISH_WORDS.test(text)
}

function elementLabel(el: InventoryElement | undefined, id: string): string {
  if (!el) return id === PAGE_EVIDENCE_ID ? 'Sayfa geneli' : id
  return `${id} · ${elementPhrase({ tag: el.tag, role: el.role, name: maskText(el.name).slice(0, 60) })}`
}

export interface EvaluatedAnswers {
  answers: RubricAnswerResult[]
  findings: Finding[]
  hallucination: HallucinationStats
  missingQuestionIds: string[]
  ignoredAnswers: number
  /** Şemaya uymadığı için ayrıştırmada atlanan cevaplar (ignoredAnswers içinde de sayılır). */
  malformedAnswers: number
}

const NON_TURKISH_NOTE = ' [Not: model bu metni Türkçe yazmadı; ham yanıt çalıştırma kaydında.]'

/** LLM bulgusunun açıklaması: envanter kimliği + öğenin Türkçe tanımı + soru + gerekçe. */
function llmDescription(el: InventoryElement | undefined, id: string, question: string, rationale: string): string {
  const why = rationale || 'Model gerekçe yazmadı.'
  return `${elementLabel(el, id)} — ${question} → Hayır. ${why}${looksNonTurkish(rationale) ? NON_TURKISH_NOTE : ''}`
}

/** LLM bulgusunun önerisi: model önerisi yoksa öğeye ve soruya özel Türkçe yedek öneri. */
function llmFix(el: InventoryElement | undefined, id: string, question: string, rationale: string, fix: string): string {
  if (fix) return `${fix}${looksNonTurkish(fix) ? NON_TURKISH_NOTE : ''}`
  const target = el ? elementLabel(el, id) : 'Sayfa'
  return `${target} için şu soruya "evet" denebilecek şekilde düzenleyin: ${question}${rationale ? ` (Gerekçe: ${rationale})` : ''}`
}

/**
 * Cevapları envantere karşı doğrular ve bulguları üretir.
 * @param inventory Yerel (maskelenmemiş seçicili) envanter; kimlik → seçici eşlemesi buradan alınır.
 */
export function evaluateAnswers(raw: RawAnswer[], inventory: Inventory, malformedAnswers = 0): EvaluatedAnswers {
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

    const ids = [...new Set(item.evidenceIds.map(normalizeEvidenceId).filter(Boolean))]
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
        description: llmDescription(primary, primaryId, question.question, item.rationale),
        fix: llmFix(primary, primaryId, question.question, item.rationale, item.fix),
        evidence: {
          highlightable: true,
          relatedElements: elementIds.slice(1).map((id) => ({ elementId: id, selector: byId.get(id)!.selector })),
        },
      })
    }
  }

  const missingQuestionIds = RUBRIC.filter((q) => !seen.has(q.id)).map((q) => q.id)
  ignoredAnswers += malformedAnswers
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
    malformedAnswers,
  }
}
