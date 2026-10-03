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

/**
 * HTTP hata yanıtını kullanıcıya gösterilecek Türkçe metne çevirir. apiKey verilirse, (olası) metin içindeki
 * anahtar maskelenir — anahtar hiçbir hata mesajına sızmaz.
 */
export function describeGeminiHttpError(status: number, body: unknown, apiKey?: string): string {
  const err = (body as { error?: { message?: unknown; status?: unknown } } | null)?.error
  let detail = typeof err?.message === 'string' ? err.message : ''
  if (apiKey) detail = detail.split(apiKey).join('[ANAHTAR]')
  const code = typeof err?.status === 'string' ? ` ${err.status}` : ''
  const suffix = detail ? `: ${detail}` : ''
  switch (status) {
    case 400:
      return `İstek reddedildi (400${code})${suffix}`
    case 401:
    case 403:
      return `Gemini API anahtarı geçersiz ya da bu modele erişim izni yok (${status}${code}).`
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
