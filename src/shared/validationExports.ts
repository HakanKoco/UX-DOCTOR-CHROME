// Doğrulama dışa aktarımlarının şeması ve kurucuları (Ödev Bölüm 4).
// Bu dosyalar YALNIZCA gerçek çalıştırmaların verisini içerir; yorum/sonuç alanları öğrenci tarafından doldurulur.
import { scoreLlm } from '@/scoring/score'
import { DEVIATION_THRESHOLD, answerAgreement, seriesStats, type AnswerAgreement, type SeriesStats } from '@/scoring/stats'
import type { PageInfo } from './contentApi'
import { PAGE_EVIDENCE_ID, type Inventory } from './inventory'
import { requestParameters, type LlmRequest, type LlmRequestParameters } from './llmRequest'
import { REPORT_SCHEMA_VERSION, type HallucinationStats, type LlmResult, type NormanPrincipleId } from './report'
import { MAX_RETRIES, RUN_INTERVAL_MS } from './retry'
import { PRINCIPLE_IDS, PRINCIPLE_LABELS, PROMPT_VERSION, questionById } from './rubric'

export interface ConsistencyRunEntry {
  runIndex: number
  runId: string
  timestamp: string
  provider: LlmResult['run']['provider']
  requestedModel: string
  servedModel: string
  fallbackUsed: boolean
  promptVersion: string
  /** 429/503 nedeniyle yapılan yeniden deneme sayısı. */
  retries: number
  stopReason: string | null
  durationMs: number
  usage: LlmResult['run']['usage']
  principleScores: Record<NormanPrincipleId, number | null>
  llmScore: number | null
  hallucination: HallucinationStats
  missingQuestionIds: string[]
  rawResponse: string
}

export interface ConsistencyFailure {
  runIndex: number
  timestamp: string
  error: string
  /** Yanıt geldi ama şemaya uymadıysa ham yanıt (çalıştırma kaydı kaybolmasın). */
  rawResponse?: string
}

export interface ConsistencyExport {
  kind: 'consistency'
  schemaVersion: string
  generatedAt: string
  page: { url: string; title: string }
  provider: LlmRequest['provider']
  requestedModel: string
  promptVersion: string
  /** Tutarlılığı etkileyen parametreler (temperature, effort/thinkingLevel, maxTokens). */
  parameters: LlmRequestParameters
  /** Çalıştırmalar arası bekleme ve 429/503 yeniden deneme kuralı (src/shared/retry.ts). */
  pacing: { runIntervalMs: number; maxRetries: number }
  requestedRuns: number
  completedRuns: number
  /** Tüm çalıştırmalarda aynı envanter ve aynı istek gövdesi kullanıldı (sapma yalnızca LLM'den gelir). */
  sameRequestBodyForAllRuns: true
  inventory: { includedCount: number; candidateCount: number; truncated: boolean; limit: number }
  requestBody: LlmRequest['body']
  runs: ConsistencyRunEntry[]
  failures: ConsistencyFailure[]
  stats: {
    principles: Record<NormanPrincipleId, SeriesStats & { label: string }>
    llmTotal: SeriesStats
    /** İlke ve toplam aralıklarının (max − min) en büyüğü. */
    maxRange: number | null
    threshold: number
    /** Herhangi bir aralık eşiği aşıyor mu (aşıyorsa README'de neden ve çözüm açıklanmalı). */
    exceedsThreshold: boolean
  }
  questionAgreement: AnswerAgreement[]
}

export function toRunEntry(result: LlmResult, runIndex: number): ConsistencyRunEntry {
  const layer = scoreLlm(result.answers)
  const principleScores = Object.fromEntries(layer.categories.map((c) => [c.id, c.score])) as Record<
    NormanPrincipleId,
    number | null
  >
  return {
    runIndex,
    runId: result.run.runId,
    timestamp: result.run.timestamp,
    provider: result.run.provider,
    requestedModel: result.run.requestedModel,
    servedModel: result.run.servedModel,
    fallbackUsed: result.run.fallbackUsed,
    promptVersion: result.run.promptVersion,
    retries: result.run.retries,
    stopReason: result.run.stopReason,
    durationMs: result.run.durationMs,
    usage: result.run.usage,
    principleScores,
    llmScore: layer.score,
    hallucination: result.hallucination,
    missingQuestionIds: result.missingQuestionIds,
    rawResponse: result.run.rawResponse,
  }
}

export function buildConsistencyExport(input: {
  page: PageInfo
  request: LlmRequest
  inventory: Inventory
  requestedRuns: number
  results: { runIndex: number; result: LlmResult }[]
  failures: ConsistencyFailure[]
}): ConsistencyExport {
  const runs = input.results.map(({ result, runIndex }) => toRunEntry(result, runIndex))
  const principles = Object.fromEntries(
    PRINCIPLE_IDS.map((id) => [id, { label: PRINCIPLE_LABELS[id], ...seriesStats(runs.map((r) => r.principleScores[id])) }]),
  ) as ConsistencyExport['stats']['principles']
  const llmTotal = seriesStats(runs.map((r) => r.llmScore))
  const ranges = [...Object.values(principles).map((p) => p.range), llmTotal.range].filter((r): r is number => r !== null)
  const maxRange = ranges.length ? Math.max(...ranges) : null
  return {
    kind: 'consistency',
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    page: { url: input.page.url, title: input.page.title },
    provider: input.request.provider,
    requestedModel: input.request.model,
    promptVersion: PROMPT_VERSION,
    parameters: requestParameters(input.request),
    pacing: { runIntervalMs: RUN_INTERVAL_MS[input.request.provider], maxRetries: MAX_RETRIES },
    requestedRuns: input.requestedRuns,
    completedRuns: runs.length,
    sameRequestBodyForAllRuns: true,
    inventory: {
      includedCount: input.inventory.meta.includedCount,
      candidateCount: input.inventory.meta.candidateCount,
      truncated: input.inventory.meta.truncated,
      limit: input.inventory.meta.limit,
    },
    requestBody: input.request.body,
    runs,
    failures: input.failures,
    stats: {
      principles,
      llmTotal,
      maxRange,
      threshold: DEVIATION_THRESHOLD,
      exceedsThreshold: maxRange !== null && maxRange > DEVIATION_THRESHOLD,
    },
    questionAgreement: answerAgreement(
      input.results.map(({ result }) => result.answers.map((a) => ({ questionId: a.questionId, answer: a.effectiveAnswer }))),
    ),
  }
}

// --- Halüsinasyon: elle doğrulama listesi ---

export interface HallucinationReviewItem {
  findingId: string
  questionId: string
  principle: string
  question: string
  severity: string
  elementId: string
  selector: string
  /** Envanterdeki öğe özeti (maskelenmiş ad). */
  element: { tag: string; role: string; name: string; nameSource: string } | null
  relatedElements: { elementId: string; selector: string }[]
  rationale: string
  fix: string
  autoCheck: { idInInventory: boolean; selectorFoundOnPage: boolean | null }
  /** ÖĞRENCİ DOLDURUR: true (sayfada gerçekten var ve doğru) / false (yok ya da yanlış). Boş bırakıldı. */
  gercekMi: null
  /** ÖĞRENCİ DOLDURUR: elle kontrol notu. */
  not: string
}

export interface HallucinationReviewExport {
  kind: 'hallucination-review'
  schemaVersion: string
  generatedAt: string
  page: { url: string; title: string }
  runId: string
  provider: LlmResult['run']['provider']
  model: { requested: string; served: string }
  promptVersion: string
  instructions: string
  /** Otomatik kontrol (1. aşama: kimlik envanterde mi, 2. aşama: seçici sayfada mı). */
  autoCheck: HallucinationStats
  /** Otomatik kontrolde düşürülen (envanterde olmayan) atıflar. */
  droppedReferences: { questionId: string; invalidIds: string[] }[]
  items: HallucinationReviewItem[]
}

export function buildHallucinationReview(input: {
  page: PageInfo
  llm: LlmResult
  inventory: Inventory | null
}): HallucinationReviewExport {
  const byId = new Map((input.inventory?.elements ?? []).map((e) => [e.id, e]))
  const missing = new Set(input.llm.hallucination.selectorCheck?.missing ?? [])
  const checked = input.llm.hallucination.selectorCheck !== undefined
  return {
    kind: 'hallucination-review',
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    page: { url: input.page.url, title: input.page.title },
    runId: input.llm.run.runId,
    provider: input.llm.run.provider,
    model: { requested: input.llm.run.requestedModel, served: input.llm.run.servedModel },
    promptVersion: input.llm.run.promptVersion,
    instructions:
      'Her bulgu için sayfayı açıp öğeyi bulun (yan paneldeki "Sayfada göster" düğmesi ya da seçici). Bulgu sayfada gerçekten varsa ve gerekçe doğruysa gercekMi=true, öğe yoksa ya da iddia yanlışsa gercekMi=false yazın. Oran = false sayısı / toplam bulgu.',
    autoCheck: input.llm.hallucination,
    droppedReferences: input.llm.answers
      .filter((a) => a.invalidEvidenceIds.length > 0)
      .map((a) => ({ questionId: a.questionId, invalidIds: a.invalidEvidenceIds })),
    items: input.llm.findings.map((f) => {
      const el = f.elementId ? byId.get(f.elementId) : undefined
      const q = questionById(f.ruleId)
      return {
        findingId: f.id,
        questionId: f.ruleId,
        principle: f.rule,
        question: q?.question ?? '',
        severity: f.severity,
        elementId: f.elementId ?? '',
        selector: f.selector,
        element: el ? { tag: el.tag, role: el.role, name: el.name, nameSource: el.nameSource } : null,
        relatedElements: f.evidence.relatedElements ?? [],
        rationale: f.description,
        fix: f.fix,
        autoCheck: {
          idInInventory: f.elementId === PAGE_EVIDENCE_ID || (f.elementId !== undefined && byId.has(f.elementId)),
          selectorFoundOnPage: checked ? !missing.has(f.selector) : null,
        },
        gercekMi: null,
        not: '',
      }
    }),
  }
}
