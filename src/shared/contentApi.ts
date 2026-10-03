// Sayfaya enjekte edilen analiz betiğinin (src/content/analyzer.ts) dışa açtığı API.
// Betik, eklentinin izole dünyasında globalThis.__uxDoctor olarak durur; sayfanın kendi betikleri erişemez.
import type { DeterministicCategoryId, Finding, ManualReviewItem, Severity } from './report'

export const CONTENT_API_VERSION = 1

export interface PageInfo {
  /** origin + pathname (sorgu dizesi ve # kişisel veri/oturum bilgisi taşıyabileceği için alınmaz). */
  url: string
  host: string
  title: string
  lang: string | null
  viewport: { width: number; height: number }
}

export interface DeterministicRaw {
  engineVersion: string
  tags: string[]
  ranAt: string
  findings: Finding[]
  manualReview: ManualReviewItem[]
  passesByCategory: Record<DeterministicCategoryId, number>
}

export interface HighlightRequestItem {
  selector: string
  label: string
  severity: Severity
}

export interface HighlightResponse {
  found: number
  missing: string[]
  firstRect: { x: number; y: number; width: number; height: number } | null
  devicePixelRatio: number
}

export interface SelectorCheck {
  selector: string
  count: number
}

export interface ContentApi {
  version: number
  getPageInfo(): PageInfo
  runDeterministic(): Promise<DeterministicRaw>
  highlight(items: HighlightRequestItem[], scrollToFirst: boolean): HighlightResponse
  clearHighlights(): void
  checkSelectors(selectors: string[]): SelectorCheck[]
}

export type ContentMethod = keyof Omit<ContentApi, 'version'>

declare global {
  // eslint-disable-next-line no-var
  var __uxDoctor: ContentApi | undefined
}
