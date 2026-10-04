// Rapor JSON şeması — TEK KAYNAK. Dışa aktarılan raporlar, yan panel ve skorlama bu tipleri kullanır.
// Şema değişirse REPORT_SCHEMA_VERSION artırılır.

export const REPORT_SCHEMA_VERSION = '1.2.0'

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
  /** Deterministik bulgularda axe'in özgün (İngilizce) metni ve kaynağı; arayüzde "Teknik ayrıntı" altında gösterilir. */
  technicalDetail?: TechnicalDetail
}

export interface TechnicalDetail {
  /** axe kuralının kısa yardım metni (İngilizce). */
  help: string
  helpUrl: string
  /** axe'in bu öğe için hata özeti (İngilizce, varsa). */
  summary?: string
}

/** axe'in "incomplete" sonuçları: ihlal sayılmaz, "elle incelenmeli" listesinde gösterilir. */
export interface ManualReviewItem {
  ruleId: string
  rule: string
  category: DeterministicCategoryId
  description: string
  /** Türkçe öneri (kural şablonundan). */
  fix: string
  technicalDetail: TechnicalDetail
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
  /** Yalnızca deterministik katmanda: toplam ağırlıklı ceza D (S = 100 · e^(−D/k)). */
  penalty?: number
}

export interface PrivacyRecord {
  /** Üç durumlu karar: "safe" (hassas değil), "uncertain" (belirsiz), "sensitive" (hassas). */
  level: 'safe' | 'uncertain' | 'sensitive'
  /** level === "sensitive". "uncertain" da LLM gönderimini kilitler (bkz. level). */
  sensitive: boolean
  /** Tüm gerekçeler (önce güçlü, sonra zayıf sinyaller). */
  reasons: string[]
  strongReasons: string[]
  weakReasons: string[]
  /** Hassas ya da belirsiz sayfada kullanıcı açık onay verdiyse true. */
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
  /** Kategori başına geçen (ihlal içermeyen) öğe sayıları (skor formülü için). */
  passesByCategory: Record<DeterministicCategoryId, number>
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
  /** Geçersiz atıf yüzünden düşürülen bulgu sayısı ("hayir" cevabının geçerli kanıtı kalmadı). */
  droppedFindings: number
  /** Hiç kanıt göstermeyen "hayir" cevapları (halüsinasyon değil; kanıtsız olduğu için "belirsiz" sayıldı). */
  evidencelessNegatives: number
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
  /** LLM sağlayıcısı: "claude" (Claude API) ya da "gemini" (Gemini API). */
  provider: 'claude' | 'gemini'
  requestedModel: string
  /** Yanıtı gerçekte üreten model (Claude'da sunucu taraflı fallback, Gemini'de modelVersion; farklı olabilir). */
  servedModel: string
  fallbackUsed: boolean
  promptVersion: string
  /** Tutarlılığı etkileyen parametreler (gönderildiği haliyle). */
  parameters: { maxTokens: number; effort?: string; temperature?: number; fallbacks?: string; thinkingLevel?: string }
  /** 429/503(/529) nedeniyle yapılan yeniden deneme sayısı (tek analizde ve tutarlılık testinde). */
  retries: number
  /**
   * Bu çalıştırma, asıl model geçici hatayla (503/429) yanıt veremeyince kullanıcının elle onayladığı yedek model
   * denemesidir ("Flash-Lite ile dene"). Tutarlılık testi istatistiğine hiçbir zaman girmez.
   */
  manualFallback?: { fromModel: string; reason: string }
  /** Claude: stop_reason; Gemini: finishReason. */
  stopReason: string | null
  durationMs: number
  usage: LlmUsage | null
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
  /** Cevaplanmayan soru kimlikleri (skorda "belirsiz" sayılır). */
  missingQuestionIds: string[]
  /** Rubrikte olmayan, ikinci kez cevaplanan ya da şemaya uymayan cevaplar (yok sayıldı). */
  ignoredAnswers: number
  /** Şemaya uymadığı için atlanan cevap sayısı. */
  malformedAnswers: number
  /**
   * Yanıtın tamamı şemaya uymadıysa Türkçe hata. Bu durumda cevap/bulgu yoktur, skor hesaplanmaz;
   * ham yanıt run.rawResponse içinde saklanır.
   */
  schemaError?: string
}

export interface ReportScores {
  deterministic: LayerScore
  /** LLM analizi yapılmadıysa null. */
  llm: LayerScore | null
  /** Ağırlıklı toplam; LLM yoksa yalnızca deterministik skordur ve llmIncluded=false olur. */
  overall: number | null
  llmIncluded: boolean
  layerWeights: { deterministic: number; llm: number }
  /** Skor formülünün sürümü (src/scoring/weights.ts). */
  formulaVersion: string
}

export interface UxReport {
  schemaVersion: string
  tool: { name: 'UX Doktor'; version: string }
  generatedAt: string
  page: {
    url: string
    title: string
    lang: string | null
    /** Analiz sırasında tarayıcı sayfa çevirisi açıktı (seçiciler kararsız olabilir; lang çeviri dili olabilir). */
    translationDetected: boolean
    translationReasons: string[]
  }
  privacy: PrivacyRecord
  deterministic: DeterministicResult
  llm: LlmResult | null
  scores: ReportScores
  /**
   * LLM'e gönderilen istek: { provider, model, body } — body onay ekranında gösterilenle aynıdır.
   * API anahtarı içermez.
   */
  llmRequestPreview?: unknown
}

// ---------------------------------------------------------------------------------------------------------------
// Çalışma zamanı doğrulayıcısı (npm run teslim-kontrol, reports/ altındaki dosyalar için). Yukarıdaki tiplerle aynı
// dosyada durur ki şema tek kaynakta kalsın; reportBuilder çıktısının buradan geçtiği birim testle güvenceye alınır.
// Yalnızca yapıyı denetler; hiçbir değeri üretmez ya da düzeltmez.

const FINDING_SOURCES: readonly FindingSource[] = ['deterministic', 'llm']
const DETERMINISTIC_CATEGORIES: readonly DeterministicCategoryId[] = [
  'contrast',
  'text-alternatives',
  'form-labels',
  'target-size',
  'language',
  'other-wcag',
]
const NORMAN_PRINCIPLES: readonly NormanPrincipleId[] = [
  'visibility',
  'feedback',
  'constraints',
  'mapping',
  'consistency',
  'affordance',
]

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v))
const isScore = (v: unknown) => v === null || (typeof v === 'number' && v >= 0 && v <= 100)

function checkFinding(f: unknown, path: string, errors: string[]) {
  if (!isObj(f)) return void errors.push(`${path}: nesne değil`)
  for (const key of ['id', 'selector', 'rule', 'ruleId', 'description', 'fix'] as const) {
    if (!isStr(f[key])) errors.push(`${path}.${key}: metin değil`)
  }
  if (!FINDING_SOURCES.includes(f.source as FindingSource)) errors.push(`${path}.source: geçersiz (${String(f.source)})`)
  if (!SEVERITIES.includes(f.severity as Severity)) errors.push(`${path}.severity: geçersiz (${String(f.severity)})`)
  const categories: readonly string[] = f.source === 'llm' ? NORMAN_PRINCIPLES : DETERMINISTIC_CATEGORIES
  if (!categories.includes(f.category as string)) errors.push(`${path}.category: geçersiz (${String(f.category)})`)
  if (f.source === 'llm' && !isStr(f.elementId)) errors.push(`${path}.elementId: LLM bulgusunda zorunlu`)
  if (!isObj(f.evidence) || typeof f.evidence.highlightable !== 'boolean') errors.push(`${path}.evidence: geçersiz`)
}

function checkLayer(layer: unknown, path: string, errors: string[]) {
  if (!isObj(layer)) return void errors.push(`${path}: nesne değil`)
  if (!isScore(layer.score)) errors.push(`${path}.score: 0-100 ya da null değil`)
  if (!Array.isArray(layer.categories)) return void errors.push(`${path}.categories: dizi değil`)
  layer.categories.forEach((c, i) => {
    if (!isObj(c) || !isStr(c.id) || !isScore(c.score)) errors.push(`${path}.categories[${i}]: geçersiz`)
  })
}

/** UxReport yapısını denetler; hata yoksa boş dizi döner. */
export function validateReport(value: unknown): string[] {
  const errors: string[] = []
  if (!isObj(value)) return ['kök: nesne değil']
  const r = value
  if (!isStr(r.schemaVersion)) errors.push('schemaVersion: metin değil')
  if (!isObj(r.tool) || r.tool.name !== 'UX Doktor' || !isStr(r.tool.version)) errors.push('tool: geçersiz')
  if (!isStr(r.generatedAt) || Number.isNaN(Date.parse(r.generatedAt))) errors.push('generatedAt: tarih değil')
  if (!isObj(r.page) || !isStr(r.page.url) || !isStr(r.page.title)) errors.push('page: url/title eksik')

  if (!isObj(r.privacy)) errors.push('privacy: nesne değil')
  else {
    if (!['safe', 'uncertain', 'sensitive'].includes(r.privacy.level as string)) errors.push('privacy.level: geçersiz')
    if (typeof r.privacy.consentGiven !== 'boolean') errors.push('privacy.consentGiven: boolean değil')
  }

  if (!isObj(r.deterministic)) errors.push('deterministic: nesne değil')
  else {
    if (r.deterministic.engine !== 'axe-core') errors.push('deterministic.engine: axe-core değil')
    if (!Array.isArray(r.deterministic.findings)) errors.push('deterministic.findings: dizi değil')
    else r.deterministic.findings.forEach((f, i) => checkFinding(f, `deterministic.findings[${i}]`, errors))
    if (!Array.isArray(r.deterministic.manualReview)) errors.push('deterministic.manualReview: dizi değil')
  }

  if (r.llm !== null) {
    if (!isObj(r.llm)) errors.push('llm: nesne ya da null değil')
    else {
      const run = r.llm.run
      if (!isObj(run)) errors.push('llm.run: nesne değil')
      else {
        if (run.provider !== 'claude' && run.provider !== 'gemini') errors.push('llm.run.provider: geçersiz')
        for (const key of ['runId', 'timestamp', 'requestedModel', 'servedModel', 'promptVersion', 'rawResponse'] as const) {
          if (!isStr(run[key])) errors.push(`llm.run.${key}: metin değil`)
        }
      }
      if (!Array.isArray(r.llm.answers)) errors.push('llm.answers: dizi değil')
      if (!Array.isArray(r.llm.findings)) errors.push('llm.findings: dizi değil')
      else r.llm.findings.forEach((f, i) => checkFinding(f, `llm.findings[${i}]`, errors))
      if (!isObj(r.llm.hallucination)) errors.push('llm.hallucination: nesne değil')
    }
  }

  if (!isObj(r.scores)) errors.push('scores: nesne değil')
  else {
    checkLayer(r.scores.deterministic, 'scores.deterministic', errors)
    if (r.scores.llm !== null) checkLayer(r.scores.llm, 'scores.llm', errors)
    if (!isScore(r.scores.overall)) errors.push('scores.overall: 0-100 ya da null değil')
    if (!isStr(r.scores.formulaVersion)) errors.push('scores.formulaVersion: metin değil')
    if (!isObj(r.scores.layerWeights) || !isNumOrNull(r.scores.layerWeights.deterministic)) errors.push('scores.layerWeights: geçersiz')
  }
  return errors
}

/**
 * Bir LLM çağrısının token kullanımı. outputTokens düşünme token'larını da içerir (Claude ile karşılaştırılabilirlik);
 * thinkingTokens Gemini'de ayrıca yazılır (usageMetadata.thoughtsTokenCount). Kaynak: ai.google.dev/api/generate-content
 */
export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number | null
  thinkingTokens?: number | null
}
