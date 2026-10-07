// LLM istek gövdesinin tek kaynağı (Claude ve Gemini). Onay ekranında gösterilen gövde ile gönderilen gövde AYNI
// nesnedir (buildLlmRequest). Yalnızca maskelenmiş envanter gider; ekran görüntüsü gönderilmez.
// İki sağlayıcıya da aynı sistem prompt'u, aynı kullanıcı mesajı (rubrik + envanter) ve aynı yanıt şeması gider.
import { PAGE_EVIDENCE_ID, toLlmInventory, type Inventory } from './inventory'
import {
  FIXED_EFFORT,
  GEMINI_TEMPERATURE,
  GEMINI_THINKING_LEVEL,
  getClaudeModelOption,
  isClaudeModelId,
  isGeminiModelId,
  type ClaudeModelId,
  type GeminiModelId,
  type GeminiTemperature,
  type ModelId,
  type Provider,
} from './models'
import { PROMPT_VERSION, PRINCIPLE_LABELS, RUBRIC } from './rubric'

export const MAX_TOKENS = 16000

/** Sunucu taraflı ret yedeği (fallbacks: "default") için beta başlığı. */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export const SYSTEM_PROMPT = `Sen bir kullanılabilirlik (UX) denetçisisin. Görevin, bir web sayfasının numaralı öğe envanterini Don Norman'ın tasarım ilkelerine göre verilen evet/hayır rubriğiyle değerlendirmek.

KURALLAR
1. Yalnızca kullanıcı mesajındaki envantere dayan. Envanterde olmayan bir öğe, metin ya da özellik uydurma.
2. Her rubrik sorusunu TAM OLARAK BİR KEZ cevapla: "evet" (ilkeye uygun), "hayir" (sorun var) ya da "belirsiz" (envanter karar vermeye yetmiyor ya da soru bu sayfaya uygulanamıyor).
3. "hayir" cevabında evidenceIds alanına sorunu gösteren öğelerin kimliklerini (E1, E2, …) envanterde yazıldığı gibi yaz. Sorun belirli bir öğeye bağlanamıyorsa (ör. sayfada hiç canlı bölge yok) yalnızca "${PAGE_EVIDENCE_ID}" kimliğini kullan ve gerekçede sayfa özetindeki ilgili alanı belirt. Kanıt gösteremiyorsan "belirsiz" de.
4. "evet" cevabında evidenceIds isteğe bağlıdır; destekleyen öğeleri yazabilirsin.
5. Puan verme. Skoru yazılım hesaplar.
6. rationale: en çok iki cümle, Türkçe, envanterdeki somut alanlara (ör. nameSource, fontSizePx, states) atıf yaparak.
7. fix: "hayir" cevabında somut ve uygulanabilir bir düzeltme (Türkçe, bir-iki cümle). Diğer cevaplarda boş metin ("").
8. Analiz statiktir: sayfayla etkileşim yapılmadı (tıklama, yazma, odaklama yok). Hover/odak/yükleme davranışını yalnızca envanterdeki ipuçlarından (states, page.styleRules, page.counts) değerlendir; ipucu yoksa "belirsiz" de.
9. Metinlerdeki [TC], [TELEFON], [E-POSTA], [IBAN], [KART] gizlilik maskeleridir; bunları sorun sayma.
10. nameSource "value-attribute-hidden" olan düğmelerin adı vardır ama gizlilik nedeniyle gönderilmemiştir; bunu "adsız öğe" sayma.
11. Envanter kesildiyse (meta.truncated=true) yalnızca görülen öğeler hakkında karar ver; görmediğin öğeler hakkında hüküm kurma.`

export interface LlmUserPayload {
  promptVersion: string
  instructions: string
  rubric: { id: string; principle: string; question: string; hint: string }[]
  inventory: Inventory
}

export function buildUserPayload(inventory: Inventory): LlmUserPayload {
  return {
    promptVersion: PROMPT_VERSION,
    instructions:
      'Aşağıdaki rubrikteki her soruyu, verilen envantere göre cevapla. Cevapları şemaya uygun JSON olarak döndür.',
    rubric: RUBRIC.map((q) => ({
      id: q.id,
      principle: PRINCIPLE_LABELS[q.principle],
      question: q.question,
      hint: q.hint,
    })),
    inventory: toLlmInventory(inventory),
  }
}

/**
 * Yapılandırılmış çıktı şeması. Claude'da output_config.format, Gemini'de generationConfig.responseFormat.text.schema
 * olarak gönderilir. Yalnızca iki sağlayıcının da desteklediği anahtar sözcükler kullanılır (type, properties, required,
 * additionalProperties, enum, items); Claude'un desteklemediği kısıtlar (minItems, pattern) kullanılmaz.
 */
export const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answers'],
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['questionId', 'answer', 'evidenceIds', 'rationale', 'fix'],
        properties: {
          questionId: { type: 'string', enum: RUBRIC.map((q) => q.id) },
          answer: { type: 'string', enum: ['evet', 'hayir', 'belirsiz'] },
          evidenceIds: { type: 'array', items: { type: 'string' } },
          rationale: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
} as const

// --- Claude ---

export interface ClaudeRequestBody {
  model: ClaudeModelId
  max_tokens: number
  system: string
  messages: { role: 'user'; content: string }[]
  output_config: { format: { type: 'json_schema'; schema: typeof RESPONSE_SCHEMA }; effort?: typeof FIXED_EFFORT }
  temperature?: number
  cache_control: { type: 'ephemeral' }
  fallbacks?: 'default'
}

/**
 * İstek gövdesini kurar. Modele göre:
 * - Opus 5.5 / Sonnet 5.5: effort sabit "medium"; temperature GÖNDERİLMEZ (bu modeller reddeder).
 *   Ret durumunda sunucu taraflı yedek model ("fallbacks": "default"); hangi modelin yanıtladığı kaydedilir.
 * - Haiku 4.5: temperature 0; effort gönderilmez (desteklenmez).
 * cache_control: aynı sayfanın tekrar analizlerinde (tutarlılık testi) girdi önbellekten okunur; çıktıyı etkilemez.
 */
export function buildClaudeRequestBody(model: ClaudeModelId, inventory: Inventory): ClaudeRequestBody {
  const option = getClaudeModelOption(model)
  if (!option) throw new Error(`Bilinmeyen model: ${model}`)
  const body: ClaudeRequestBody = {
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(buildUserPayload(inventory)) }],
    output_config: {
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      ...(option.supportsEffort ? { effort: FIXED_EFFORT } : {}),
    },
    cache_control: { type: 'ephemeral' },
  }
  if (option.supportsTemperature) body.temperature = 0
  if (option.supportsServerFallback) body.fallbacks = 'default'
  return body
}

/** Gövdenin gerektirdiği beta başlıkları (onay ekranında da gösterilir). */
export function requiredBetas(body: ClaudeRequestBody): string[] {
  return body.fallbacks ? [FALLBACK_BETA] : []
}

// --- Gemini (generateContent) ---
// Kaynak: https://ai.google.dev/api/generate-content ve
// https://ai.google.dev/gemini-api/docs/generate-content/structured-output (2026-10-03'te kontrol edildi).
// Model adı gövdede değil URL'dedir; anahtar URL'de değil x-goog-api-key başlığındadır.

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export interface GeminiRequestBody {
  systemInstruction: { parts: { text: string }[] }
  contents: { role: 'user'; parts: { text: string }[] }[]
  generationConfig: {
    temperature: number
    maxOutputTokens: number
    thinkingConfig: { thinkingLevel: typeof GEMINI_THINKING_LEVEL }
    /**
     * responseSchema / responseJsonSchema dokümanda "Deprecated. Use responseFormat instead." olarak işaretli.
     * mimeType: API referansındaki TextResponseFormat.MimeType enum değeri (APPLICATION_JSON). Rehberdeki REST örneğinde
     * geçen "application/json" sunucuda 400 "Invalid value at 'generation_config.response_format.text.mime_type'" döndürür
     * (2026-10-03'te sahte anahtarla gözlendi: gövde, anahtardan önce doğrulanıyor).
     */
    responseFormat: { text: { mimeType: 'APPLICATION_JSON'; schema: typeof RESPONSE_SCHEMA } }
  }
}

export function geminiGenerateUrl(model: GeminiModelId): string {
  return `${GEMINI_API_BASE}/models/${model}:generateContent`
}

/**
 * Gemini istek gövdesi:
 * - temperature varsayılan 1.0 (Google'ın Gemini 3 önerisi; bkz. models.ts GEMINI_TEMPERATURE); tutarlılık
 *   deneyi için ayarlardan 0 seçilebilir (GEMINI_TEMPERATURE_OPTIONS),
 * - thinkingLevel sabit MEDIUM (Claude'daki effort "medium" ile aynı düzey),
 * - Claude ile aynı sistem prompt'u, aynı kullanıcı mesajı ve aynı JSON şeması.
 */
export function buildGeminiRequestBody(
  inventory: Inventory,
  temperature: GeminiTemperature = GEMINI_TEMPERATURE,
): GeminiRequestBody {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(buildUserPayload(inventory)) }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: MAX_TOKENS,
      thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL },
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: RESPONSE_SCHEMA } },
    },
  }
}

// --- Sağlayıcıdan bağımsız istek ---

export type LlmRequest =
  | { provider: 'claude'; model: ClaudeModelId; body: ClaudeRequestBody }
  | { provider: 'gemini'; model: GeminiModelId; body: GeminiRequestBody }

/** geminiTemperature yalnızca Gemini isteğinde kullanılır; Claude tarafının parametreleri modele göre sabittir. */
export function buildLlmRequest(
  model: ModelId,
  inventory: Inventory,
  options: { geminiTemperature?: GeminiTemperature } = {},
): LlmRequest {
  if (isClaudeModelId(model)) return { provider: 'claude', model, body: buildClaudeRequestBody(model, inventory) }
  if (isGeminiModelId(model)) {
    return { provider: 'gemini', model, body: buildGeminiRequestBody(inventory, options.geminiTemperature) }
  }
  throw new Error(`Bilinmeyen model: ${String(model)}`)
}

export const PROVIDER_API_NAMES: Record<Provider, string> = { claude: 'Claude API', gemini: 'Gemini API' }

/** Onay ekranında gösterilen istek hedefi ve başlıklar. API anahtarı ASLA dahil edilmez (service worker ekler). */
export function requestTransportPreview(request: LlmRequest): {
  url: string
  keyHeader: string
  headers: Record<string, string>
} {
  if (request.provider === 'gemini') {
    return { url: geminiGenerateUrl(request.model), keyHeader: 'x-goog-api-key', headers: { 'content-type': 'application/json' } }
  }
  const betas = requiredBetas(request.body)
  return {
    url: 'https://api.anthropic.com/v1/messages',
    keyHeader: 'x-api-key',
    headers: {
      'anthropic-dangerous-direct-browser-access': 'true',
      ...(betas.length > 0 ? { 'anthropic-beta': betas.join(',') } : {}),
    },
  }
}

export interface LlmRequestParameters {
  maxTokens: number
  effort?: string
  temperature?: number
  fallbacks?: string
  thinkingLevel?: string
}

/** Tutarlılığı etkileyen parametreler (çalıştırma kaydına gönderildiği haliyle yazılır). */
export function requestParameters(request: LlmRequest): LlmRequestParameters {
  if (request.provider === 'gemini') {
    const c = request.body.generationConfig
    return { maxTokens: c.maxOutputTokens, temperature: c.temperature, thinkingLevel: c.thinkingConfig.thinkingLevel }
  }
  const b = request.body
  return {
    maxTokens: b.max_tokens,
    ...(b.output_config.effort ? { effort: b.output_config.effort } : {}),
    ...(b.temperature !== undefined ? { temperature: b.temperature } : {}),
    ...(b.fallbacks ? { fallbacks: b.fallbacks } : {}),
  }
}
