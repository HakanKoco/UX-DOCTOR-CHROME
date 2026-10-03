// Rapor JSON şeması — TEK KAYNAK. Dışa aktarılan raporlar, yan panel ve skorlama bu tipleri kullanır.
// Şema değişirse REPORT_SCHEMA_VERSION artırılır.

export const REPORT_SCHEMA_VERSION = '1.0.0'

export type Severity = 'Kritik' | 'Yüksek' | 'Orta' | 'Düşük'
export const SEVERITIES: readonly Severity[] = ['Kritik', 'Yüksek', 'Orta', 'Düşük']

export type FindingSource = 'deterministic' | 'llm'

/** Deterministik katmanın kategori kimlikleri (çekirdek 5 kontrol + diğer WCAG ihlalleri). */
export type DeterministicCategoryId = 'contrast' | 'text-alternatives' | 'form-labels' | 'target-size' | 'language' | 'other-wcag'

/** Norman'ın 6 ilkesi. */
export type NormanPrincipleId = 'visibility' | 'feedback' | 'constraints' | 'mapping' | 'consistency' | 'affordance'

export interface FindingEvidence {
  /** Sayfada vurgulanabilir mi (seçici benzersiz ve doğrulanmış). */
  highlightable: boolean
  /** axe'in döndürdüğü HTML parçası; value attribute'ları ve kişisel veriler maskelenmiş. */
  html?: string
  /** İsteğe bağlı kırpılmış ekran görüntüsü (data URL). Yalnızca yerelde kalır, LLM'e gönderilmez. */
  screenshot?: string
  /** LLM bulgusunda kanıt olarak gösterilen diğer öğeler. */
  relatedElements?: { elementId: string; selector: string }[]
}

export interface Finding {
  id: string
  source: FindingSource
  /** Benzersiz CSS seçici (querySelectorAll ile tekilliği doğrulanır). */
  selector: string
  /** Yalnızca LLM bulgularında: envanterdeki öğe kimliği (E1, E2, …). */
  elementId?: string
  /** Ör. "WCAG 1.4.3" veya "Norman: Geri Bildirim". */
  rule: string
  /** axe kural kimliği ya da rubrik soru kimliği. */
  ruleId: string
  category: DeterministicCategoryId | NormanPrincipleId
  severity: Severity
  description: string
  fix: string
  evidence: FindingEvidence
}

/** axe'in "incomplete" sonuçları: ihlal sayılmaz, "elle incelenmeli" listesinde gösterilir. */
export interface ManualReviewItem {
  ruleId: string
  rule: string
  category: DeterministicCategoryId
  description: string
  nodes: { selector: string; highlightable: boolean; html?: string; reason?: string }[]
}

export interface CategoryScore {
  id: string
  label: string
  /** 0-100; uygulanabilir öğe yoksa null (toplamdan çıkarılır). */
  score: number | null
  weight: number
  /** Skorun nasıl hesaplandığına dair sayılar (README'deki formülle birebir). */
  detail: Record<string, number>
}

export interface LayerScore {
  /** 0-100; hiçbir alt skor hesaplanamadıysa null. */
  score: number | null
  categories: CategoryScore[]
}

export interface PrivacyRecord {
  sensitive: boolean
  reasons: string[]
  /** Hassas sayfada kullanıcı açık onay verdiyse true. */
  consentGiven: boolean
  consentAt?: string
}

export interface DeterministicResult {
  engine: 'axe-core'
  engineVersion: string
  tags: string[]
  ranAt: string
  findings: Finding[]
  manualReview: ManualReviewItem[]
  /** Kural başına geçen öğe sayıları (skor formülü için). */
  passesByCategory: Record<DeterministicCategoryId, number>
  score: LayerScore
}

export type RubricAnswerValue = 'evet' | 'hayir' | 'belirsiz'

export interface RubricAnswerResult {
  questionId: string
  principle: NormanPrincipleId
  /** LLM'in ham cevabı. */
  rawAnswer: RubricAnswerValue
  /** Kimlik doğrulamasından sonra skorda kullanılan cevap (kanıtı kalmayan "hayir" → "belirsiz"). */
  effectiveAnswer: RubricAnswerValue
  evidenceIds: string[]
  invalidEvidenceIds: string[]
  rationale: string
  fix: string
}

export interface HallucinationStats {
  /** LLM'in atıf yaptığı toplam kimlik sayısı. */
  totalReferences: number
  /** Envanterde olmayan kimlik sayısı. */
  invalidReferences: number
  /** Geçersiz atıf yüzünden düşürülen bulgu sayısı. */
  droppedFindings: number
  /** invalidReferences / totalReferences (atıf yoksa null). */
  invalidReferenceRate: number | null
  /** Envanterde olmayan kimlikler. */
  invalidIds: string[]
  /** Bulgu seçicilerinin sayfada yeniden bulunup bulunmadığı (otomatik kontrol, ikinci aşama). */
  selectorCheck?: { checked: number; found: number; missing: string[] }
}

export interface LlmRunRecord {
  runId: string
  timestamp: string
  requestedModel: string
  /** Yanıtı gerçekte üreten model (sunucu taraflı fallback olduysa farklı olabilir). */
  servedModel: string
  fallbackUsed: boolean
  promptVersion: string
  stopReason: string | null
  durationMs: number
  usage: { inputTokens: number; outputTokens: number } | null
  /** Ham LLM yanıt metni (yapılandırılmış JSON). */
  rawResponse: string
}

export interface InventoryMeta {
  includedCount: number
  candidateCount: number
  truncated: boolean
  limit: number
}

export interface LlmResult {
  run: LlmRunRecord
  inventory: InventoryMeta
  answers: RubricAnswerResult[]
  findings: Finding[]
  hallucination: HallucinationStats
  /** Şema dışı/eksik cevaplar (cevapsız soru kimlikleri). */
  missingQuestionIds: string[]
  score: LayerScore
}

export interface UxReport {
  schemaVersion: string
  tool: { name: 'UX Doktor'; version: string }
  generatedAt: string
  page: { url: string; title: string; lang: string | null }
  privacy: PrivacyRecord
  deterministic: DeterministicResult
  llm: LlmResult | null
  scores: {
    deterministic: number | null
    llm: number | null
    /** Ağırlıklı toplam; LLM yoksa yalnızca deterministik skordur ve llmIncluded=false olur. */
    overall: number | null
    llmIncluded: boolean
    layerWeights: { deterministic: number; llm: number }
  }
  /** LLM'e gönderilen istek gövdesi (onay ekranında gösterilenle aynı). API anahtarı içermez. */
  llmRequestPreview?: unknown
}
