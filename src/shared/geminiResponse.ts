// Gemini generateContent yanıtının ve hata gövdesinin yorumlanması (saf fonksiyonlar, birim testli).
// Kaynak: https://ai.google.dev/api/generate-content (GenerateContentResponse, Candidate, FinishReason,
// PromptFeedback.BlockReason, UsageMetadata) — 2026-10-03'te kontrol edildi.

export interface GeminiParsedSuccess {
  ok: true
  rawText: string
  /** Yanıtı üreten model sürümü (modelVersion; yoksa istenen model). */
  servedModel: string
  /** candidates[0].finishReason */
  stopReason: string | null
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number | null } | null
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
    case 429:
      return `İstek sınırına takıldınız (429${code}). Ücretsiz katman sınırlarınızı Google AI Studio'da görebilirsiniz.`
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
  ]
}
