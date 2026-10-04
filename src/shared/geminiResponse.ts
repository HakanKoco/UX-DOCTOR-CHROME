// Gemini generateContent yanıtının ve hata gövdesinin yorumlanması (saf fonksiyonlar, birim testli).
// Kaynak: https://ai.google.dev/api/generate-content (GenerateContentResponse, Candidate, FinishReason,
// PromptFeedback.BlockReason, UsageMetadata) — 2026-10-03'te kontrol edildi.
import type { LlmUsage } from './report'

export interface GeminiParsedSuccess {
  ok: true
  rawText: string
  /** Yanıtı üreten model sürümü (modelVersion; yoksa istenen model). */
  servedModel: string
  /** candidates[0].finishReason */
  stopReason: string | null
  usage: LlmUsage | null
}

export interface GeminiParsedFailure {
  ok: false
  error: string
}

interface GeminiPart {
  text?: string
  /** Düşünce parçası (includeThoughts açıksa döner); yanıt metnine katılmaz. */
  thought?: boolean
}

interface GeminiResponseShape {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
    cachedContentTokenCount?: number
  }
  modelVersion?: string
}

/** Yanıtı kesik ya da güvenilmez kılan bitiş nedenleri (STOP dışındakiler). */
const BLOCKING_FINISH_REASONS: Record<string, string> = {
  SAFETY: 'güvenlik filtresi',
  RECITATION: 'alıntı (recitation) filtresi',
  BLOCKLIST: 'yasaklı terim listesi',
  PROHIBITED_CONTENT: 'yasaklı içerik',
  SPII: 'hassas kişisel veri (SPII) şüphesi',
  LANGUAGE: 'desteklenmeyen dil',
  OTHER: 'belirtilmemiş neden',
}

export function parseGeminiResponse(data: unknown, requestedModel: string): GeminiParsedSuccess | GeminiParsedFailure {
  const r = (data ?? {}) as GeminiResponseShape
  const blockReason = r.promptFeedback?.blockReason
  if (blockReason) return { ok: false, error: `Gemini isteği reddetti (promptFeedback.blockReason: ${blockReason}).` }

  const candidate = r.candidates?.[0]
  if (!candidate) return { ok: false, error: 'Gemini yanıtında aday (candidate) yok.' }

  const finishReason = candidate.finishReason ?? null
  if (finishReason === 'MAX_TOKENS') {
    return { ok: false, error: 'Yanıt maxOutputTokens sınırında kesildi (MAX_TOKENS); JSON eksik olabilir.' }
  }
  if (finishReason && finishReason in BLOCKING_FINISH_REASONS) {
    return { ok: false, error: `Gemini yanıtı durdurdu: ${BLOCKING_FINISH_REASONS[finishReason]} (finishReason: ${finishReason}).` }
  }

  const rawText = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
  if (rawText.length === 0) return { ok: false, error: `Gemini boş yanıt döndürdü (finishReason: ${finishReason ?? 'yok'}).` }

  const u = r.usageMetadata
  return {
    ok: true,
    rawText,
    servedModel: r.modelVersion ?? requestedModel,
    stopReason: finishReason,
    // Claude'un output_tokens değeri düşünme token'larını da içerdiği için karşılaştırılabilirlik adına
    // çıktı = candidatesTokenCount + thoughtsTokenCount.
    usage: u
      ? {
          inputTokens: u.promptTokenCount ?? 0,
          outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
          cacheReadInputTokens: u.cachedContentTokenCount ?? null,
          thinkingTokens: u.thoughtsTokenCount ?? null,
        }
      : null,
  }
}

// --- Hata gövdesi ve güvenli teşhis bilgisi ---
// Google API hata gövdesi: { error: { code, message, status, details: [{ "@type": "...ErrorInfo", reason }] } }.
// Aşağıdaki durumlar 2026-10-03'te sahte anahtarlarla gözlendi (gerçek anahtar kullanılmadı):
// - geçersiz anahtar (x-goog-api-key)       → 400 INVALID_ARGUMENT, reason API_KEY_INVALID
// - "AQ." önekli değer (x-goog-api-key)     → 401 UNAUTHENTICATED, reason ACCESS_TOKEN_TYPE_UNSUPPORTED
// - anahtarsız istek                        → 403 PERMISSION_DENIED
// - gövdede geçersiz enum değeri            → 400 INVALID_ARGUMENT ("Invalid value at ..."; anahtardan önce denetlenir)

export interface GoogleErrorInfo {
  /** Google'ın hata durumu, ör. "UNAUTHENTICATED". */
  status: string | null
  /** ErrorInfo.reason, ör. "API_KEY_INVALID". */
  reason: string | null
  /** Google'ın hata mesajı (anahtar geçerse maskelenmiş). */
  message: string | null
}

/** Anahtarın türü hakkında, anahtarın hiçbir karakterini açığa çıkarmayan kaba sınıf. */
export type KeyShape = 'AIza önekli' | 'AQ. önekli' | 'diğer biçim'

export interface GeminiDiagnostics extends GoogleErrorInfo {
  httpStatus: number
  /** İsteğin gittiği yol (alan adı ve sorgu dizesi olmadan; anahtar asla URL'de değildir). */
  endpointPath: string
  model: string
  keyShape: KeyShape | null
  keyLength: number | null
  /** 429'da Google'ın kota ayrıntısı (QuotaFailure / RetryInfo); yoksa null. */
  quota?: QuotaInfo | null
}

// --- 429 kota ayrıntısı ---
// Biçim (doğrulandı): google/rpc/error_details.proto — QuotaFailure.Violation { subject, description, api_service,
// quota_metric, quota_id, quota_dimensions, quota_value (int64), future_quota_value } ve RetryInfo { retry_delay
// (Duration) }. ProtoJSON: alan adları lowerCamelCase, int64 metin ("250"), Duration "38s" / "1.500s"
// (https://protobuf.dev/programming-guides/json/). @type: "type.googleapis.com/google.rpc.QuotaFailure" | "...RetryInfo".
// Gemini dokümanı 429 gövdesinin örneğini ve quotaId adlandırmasını YAYIMLAMIYOR (rate-limits ve troubleshooting
// sayfaları, 2026-10-04). Bu yüzden kotanın türü quotaId/quotaMetric metnindeki kalıplardan SEZGİSEL çıkarılır;
// kalıp tanınmazsa "unknown" döner ve tahmin yürütülmez.

/** rpd: günlük kota (istek ya da token; aynı gün yeniden denemek anlamsız); rpm: dakikalık istek; tpm: dakikalık (girdi) token; unknown: tanınmadı. */
export type QuotaKind = 'rpd' | 'rpm' | 'tpm' | 'unknown'

export interface QuotaInfo {
  kind: QuotaKind
  quotaId: string | null
  quotaMetric: string | null
  quotaValue: string | null
  /** RetryInfo.retryDelay (ms); Google önermediyse null. */
  retryDelayMs: number | null
}

const QUOTA_KIND_PRIORITY: QuotaKind[] = ['rpd', 'tpm', 'rpm', 'unknown']

export const QUOTA_KIND_LABELS: Record<QuotaKind, string> = {
  rpd: 'günlük kota (RPD; günlük token sınırı da bu sınıfa girer)',
  rpm: 'dakikalık istek kotası (RPM)',
  tpm: 'dakikalık token kotası (TPM)',
  unknown: 'türü tanınmayan kota',
}

/** "38s", "1.500s" → ms. Geçersizse null. */
export function parseDurationMs(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim())
  return m ? Math.round(Number(m[1]) * 1000) : null
}

export function classifyQuota(quotaId: string | null, quotaMetric: string | null): QuotaKind {
  const text = `${quotaId ?? ''} ${quotaMetric ?? ''}`
  if (/per\s*day|perday|daily|_day\b/i.test(text)) return 'rpd'
  if (/token/i.test(text)) return 'tpm'
  if (/per\s*minute|perminute|_minute\b|requests?/i.test(text)) return 'rpm'
  return 'unknown'
}

type Detail = Record<string, unknown>

/** 429 gövdesinden kota ayrıntısı; QuotaFailure ya da RetryInfo yoksa null. */
export function parseQuotaInfo(body: unknown): QuotaInfo | null {
  const details = (body as { error?: { details?: unknown } } | null)?.error?.details
  if (!Array.isArray(details)) return null
  const typed = details.filter((d): d is Detail => typeof d === 'object' && d !== null)
  const ofType = (suffix: string) => typed.filter((d) => typeof d['@type'] === 'string' && (d['@type'] as string).endsWith(suffix))
  const retry = ofType('google.rpc.RetryInfo')[0]
  const violations = ofType('google.rpc.QuotaFailure').flatMap((d) =>
    Array.isArray(d.violations) ? (d.violations as unknown[]).filter((v): v is Detail => typeof v === 'object' && v !== null) : [],
  )
  if (!retry && violations.length === 0) return null

  const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null)
  const parsed = violations.map((v) => {
    const quotaId = str(v.quotaId)
    const quotaMetric = str(v.quotaMetric)
    return { kind: classifyQuota(quotaId, quotaMetric), quotaId, quotaMetric, quotaValue: str(v.quotaValue) }
  })
  // Birden çok ihlal varsa en kısıtlayıcısı (günlük > token > istek) esas alınır.
  parsed.sort((a, b) => QUOTA_KIND_PRIORITY.indexOf(a.kind) - QUOTA_KIND_PRIORITY.indexOf(b.kind))
  const top = parsed[0]
  return {
    kind: top?.kind ?? 'unknown',
    quotaId: top?.quotaId ?? null,
    quotaMetric: top?.quotaMetric ?? null,
    quotaValue: top?.quotaValue ?? null,
    retryDelayMs: parseDurationMs(retry?.retryDelay),
  }
}

/** Bir anın verilen saat dilimindeki UTC farkı (dk). */
function tzOffsetMinutes(at: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60000)
}

/**
 * Günlük kotanın sıfırlanacağı an: bir sonraki Pasifik gece yarısı ("RPD quotas reset at midnight Pacific time",
 * ai.google.dev/gemini-api/docs/rate-limits). Yaz/kış saati Intl ile çalışma anında hesaplanır.
 */
export function nextPacificMidnight(now: number): number {
  const tz = 'America/Los_Angeles'
  const local = new Date(now + tzOffsetMinutes(now, tz) * 60000)
  let target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - tzOffsetMinutes(now, tz) * 60000
  // Gece yarısı ile şimdi arasında saat değişimi olduysa farkı hedef anda yeniden hesapla.
  target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - tzOffsetMinutes(target, tz) * 60000
  return target
}

/** Türkiye saatiyle okunur biçim, ör. "5 Ekim 10:00". */
export function formatTurkeyTime(at: number): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at)
}

/** 429 için Türkçe teşhis metni (anahtar içermez). */
export function describeQuota(quota: QuotaInfo, now: number = Date.now()): string {
  const limit = quota.quotaValue ? ` (sınır: ${quota.quotaValue})` : ''
  if (quota.kind === 'rpd') {
    return `Günlük ücretsiz kota doldu${limit}. Pasifik saatiyle gece yarısı sıfırlanır (Türkiye saatiyle ${formatTurkeyTime(nextPacificMidnight(now))}). Yeniden denenmeyecek; boşuna istek harcanmaz.`
  }
  const wait = quota.retryDelayMs !== null ? ` Google ${Math.ceil(quota.retryDelayMs / 1000)} sn beklemeyi öneriyor.` : ''
  return `${QUOTA_KIND_LABELS[quota.kind][0].toUpperCase()}${QUOTA_KIND_LABELS[quota.kind].slice(1)} doldu${limit}.${wait}`
}

export function maskKey(text: string, apiKey?: string): string {
  return apiKey ? text.split(apiKey).join('[ANAHTAR]') : text
}

export function parseGoogleError(body: unknown, apiKey?: string): GoogleErrorInfo {
  const err = (body as { error?: { message?: unknown; status?: unknown; details?: unknown } } | null)?.error
  const details = Array.isArray(err?.details) ? err.details : []
  const reason = details.map((d) => (d as { reason?: unknown })?.reason).find((r): r is string => typeof r === 'string')
  return {
    status: typeof err?.status === 'string' ? err.status : null,
    reason: reason ?? null,
    message: typeof err?.message === 'string' ? maskKey(err.message, apiKey).slice(0, 300) : null,
  }
}

export function keyShape(apiKey: string): KeyShape {
  if (apiKey.startsWith('AIza')) return 'AIza önekli'
  if (apiKey.startsWith('AQ.')) return 'AQ. önekli'
  return 'diğer biçim'
}

/** Teşhis bilgisi. Anahtarın kendisi yer almaz; yalnızca kaba biçim sınıfı ve uzunluğu. */
export function buildGeminiDiagnostics(input: {
  httpStatus: number
  body: unknown
  endpointPath: string
  model: string
  apiKey?: string
}): GeminiDiagnostics {
  return {
    httpStatus: input.httpStatus,
    ...parseGoogleError(input.body, input.apiKey),
    endpointPath: input.endpointPath,
    model: input.model,
    keyShape: input.apiKey ? keyShape(input.apiKey) : null,
    keyLength: input.apiKey ? input.apiKey.length : null,
    quota: input.httpStatus === 429 ? parseQuotaInfo(input.body) : null,
  }
}

/**
 * HTTP hata yanıtını kullanıcıya gösterilecek Türkçe metne çevirir. apiKey verilirse, (olası) metin içindeki
 * anahtar maskelenir — anahtar hiçbir hata mesajına sızmaz.
 */
export function describeGeminiHttpError(status: number, body: unknown, apiKey?: string): string {
  const g = parseGoogleError(body, apiKey)
  const code = g.status ? ` ${g.status}` : ''
  const suffix = g.message ? `: ${g.message}` : ''
  if (g.reason === 'API_KEY_INVALID') {
    return `Gemini API anahtarı geçersiz (${status} API_KEY_INVALID). Anahtarı AI Studio'dan yeniden kopyalayın.`
  }
  if (g.reason === 'ACCESS_TOKEN_TYPE_UNSUPPORTED') {
    return `Anahtar, API anahtarı olarak değil erişim belirteci (access token) olarak yorumlandı ve kabul edilmedi (401 ACCESS_TOKEN_TYPE_UNSUPPORTED). AI Studio'daki "API key" sayfasından kopyaladığınız değeri kullandığınızdan emin olun.`
  }
  switch (status) {
    case 400:
      return `İstek reddedildi (400${code})${suffix}`
    case 401:
      return `Kimlik doğrulanamadı (401${code}). Anahtar tanınmadı${g.reason ? ` (neden: ${g.reason})` : ''}.`
    case 403:
      return `Erişim reddedildi (403${code}). Anahtar eksik ya da bu modele/API'ye erişim izni yok${g.reason ? ` (neden: ${g.reason})` : ''}.`
    case 404:
      return `Model bulunamadı (404). Ayarlardan başka bir model seçin.`
    case 429: {
      const quota = parseQuotaInfo(body)
      return quota
        ? `İstek sınırına takıldınız (429${code}). ${describeQuota(quota)}`
        : `İstek sınırına takıldınız (429${code}). Google kota ayrıntısı göndermedi; sınırlarınızı AI Studio'da (aistudio.google.com/rate-limit) görebilirsiniz.`
    }
    case 503:
      return `Gemini API geçici olarak kullanılamıyor (503${code}).`
    default:
      return `Gemini API hatası (${status}${code})${suffix}`
  }
}

/** Teşhis kutusunda gösterilecek satırlar (etiket, değer). Anahtarın karakterleri hiçbir satırda yer almaz. */
export function diagnosticsRows(d: GeminiDiagnostics): [string, string][] {
  return [
    ['HTTP durumu', String(d.httpStatus)],
    ['Google status', d.status ?? '—'],
    ['Google reason', d.reason ?? '—'],
    ['Google message', d.message ?? '—'],
    ['Uç nokta yolu', d.endpointPath],
    ['Model', d.model],
    ['Anahtar biçimi', d.keyShape ? `${d.keyShape}, ${d.keyLength} karakter` : '—'],
    ...(d.quota
      ? ([
          ['Kota türü', QUOTA_KIND_LABELS[d.quota.kind]],
          ['quotaId', d.quota.quotaId ?? '—'],
          ['quotaMetric', d.quota.quotaMetric ?? '—'],
          ['quotaValue', d.quota.quotaValue ?? '—'],
          ['Önerilen bekleme', d.quota.retryDelayMs !== null ? `${Math.ceil(d.quota.retryDelayMs / 1000)} sn` : '—'],
        ] as [string, string][])
      : []),
  ]
}
