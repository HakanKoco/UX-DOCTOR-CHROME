// Rapor nesnesini (src/shared/report.ts şeması) analiz sonuçlarından kurar.
import { combineScores, scoreDeterministic, scoreLlm } from '@/scoring/score'
import type { DeterministicRaw, PageInfo } from './contentApi'
import type { LlmRequest } from './llmRequest'
import { REPORT_SCHEMA_VERSION, type LlmResult, type PrivacyRecord, type UxReport } from './report'

export interface ReportInput {
  toolVersion: string
  page: PageInfo
  privacy: PrivacyRecord
  det: DeterministicRaw
  llm: LlmResult | null
  /** LLM'e gönderilen istek (sağlayıcı, model ve onay ekranında gösterilen gövde; anahtar içermez). */
  llmRequest: LlmRequest | null
}

export function buildReport(input: ReportInput): UxReport {
  const deterministicScore = scoreDeterministic(input.det.findings, input.det.passesByCategory)
  const llmScore = input.llm ? scoreLlm(input.llm.answers) : null
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: { name: 'UX Doktor', version: input.toolVersion },
    generatedAt: new Date().toISOString(),
    page: {
      url: input.page.url,
      title: input.page.title,
      lang: input.page.lang,
      translationDetected: input.page.translation.detected,
      translationReasons: input.page.translation.reasons,
    },
    privacy: input.privacy,
    deterministic: {
      engine: 'axe-core',
      engineVersion: input.det.engineVersion,
      tags: input.det.tags,
      ranAt: input.det.ranAt,
      findings: input.det.findings,
      manualReview: input.det.manualReview,
      passesByCategory: input.det.passesByCategory,
    },
    llm: input.llm,
    scores: combineScores(deterministicScore, llmScore),
    ...(input.llmRequest ? { llmRequestPreview: input.llmRequest } : {}),
  }
}

/** Dosya adında kullanılacak güvenli parça: "www.ornek.gov.tr" → "www-ornek-gov-tr". */
export function slugForFile(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'sayfa'
  )
}

export function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}
