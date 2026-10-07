// Seçilebilir LLM sağlayıcıları, modelleri ve her modelin kabul ettiği parametreler.
//
// Claude — kaynak: Claude API dokümantasyonu (model tablosu, "Thinking & Effort" bölümü).
// - Opus 5.5 ve Sonnet 5.5: temperature gönderilirse 400 döner; tutarlılık için effort sabitlenir.
// - Haiku 4.5: effort desteklenmez; temperature 0 gönderilir.
//
// Gemini — kaynak: https://ai.google.dev/gemini-api/docs/models ve /pricing (2026-10-03'te kontrol edildi).
// - gemini-3.8-flash ve gemini-3.5-flash-lite kararlı (stable) modellerdir; ikisi de ücretsiz katmanda
//   ("Standard → Free Tier": girdi/çıktı "Free of charge") kullanılabilir. Google yeni projeler için
//   "3.5 Flash-Lite or 3.8 Flash" önerir.

export type Provider = 'claude' | 'gemini'

export type ClaudeModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-4-5'
export type GeminiModelId = 'gemini-3.8-flash' | 'gemini-3.5-flash-lite'
export type ModelId = ClaudeModelId | GeminiModelId

export const PROVIDER_LABELS: Record<Provider, string> = {
  claude: 'Claude (Anthropic)',
  gemini: 'Gemini (Google, ücretsiz katman)',
}

export interface ClaudeModelOption {
  id: ClaudeModelId
  label: string
  /** output_config.effort gönderilebilir mi */
  supportsEffort: boolean
  /** temperature parametresi kabul ediliyor mu */
  supportsTemperature: boolean
  /** Sunucu taraflı "fallbacks: default" (ret durumunda başka modele aktarım) destekleniyor mu */
  supportsServerFallback: boolean
}

export const CLAUDE_MODEL_OPTIONS: readonly ClaudeModelOption[] = [
  {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5 (varsayılan, en yetenekli)',
    supportsEffort: true,
    supportsTemperature: false,
    supportsServerFallback: true,
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5 (daha hızlı, daha ucuz)',
    supportsEffort: true,
    supportsTemperature: false,
    supportsServerFallback: true,
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5 (en ucuz, temperature 0)',
    supportsEffort: false,
    supportsTemperature: true,
    supportsServerFallback: false,
  },
]

export interface GeminiModelOption {
  id: GeminiModelId
  label: string
}

export const GEMINI_MODEL_OPTIONS: readonly GeminiModelOption[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (varsayılan, ücretsiz katman)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (daha hafif, ücretsiz katman)' },
]

export const DEFAULT_PROVIDER: Provider = 'claude'
export const DEFAULT_CLAUDE_MODEL: ClaudeModelId = 'claude-opus-5-5'
export const DEFAULT_GEMINI_MODEL: GeminiModelId = 'gemini-3.8-flash'

/**
 * Asıl Gemini modeli geçici hatayla (503/429) yanıt veremezse panelin önerdiği, YALNIZCA kullanıcının elle
 * onayladığı yedek model ("Flash-Lite ile dene"). Otomatik geçiş yapılmaz: tutarlılık testi tek model ister.
 */
export const FALLBACK_GEMINI_MODEL: GeminiModelId = 'gemini-3.5-flash-lite'

/** Claude'da tüm çalıştırmalarda sabit tutulan effort düzeyi (Opus 5.5 varsayılanı da "medium"; açıkça yazıyoruz). */
export const FIXED_EFFORT = 'medium' as const

/**
 * Gemini'de sabit düşünme düzeyi (Claude tarafındaki effort ile aynı düzey). Flash'ta varsayılan "high"dır;
 * tutarlılık için açıkça gönderilir. Kaynak: ai.google.dev/api/generate-content (ThinkingLevel: MINIMAL, LOW, MEDIUM, HIGH).
 */
export const GEMINI_THINKING_LEVEL = 'MEDIUM' as const

/**
 * Gemini temperature: Google'ın önerisine uyularak varsayılan 1.0 açıkça gönderilir.
 * "For all Gemini 3 models, we strongly recommend keeping the temperature parameter at its default value of 1.0.
 * Changing the temperature (setting it below 1.0) may lead to unexpected behavior, such as looping or degraded
 * performance" — https://ai.google.dev/gemini-api/docs/gemini-3
 */
export const GEMINI_TEMPERATURE = 1.0

/**
 * Tutarlılık deneyi için seçilebilen Gemini temperature değerleri. 1.0 varsayılandır (Google önerisi); 0 yalnızca
 * öğrencinin kararıyla yapılan ayrı deney içindir (tutarlılık sapması 10 puanı aştı, Ödev 4.a). API aralığı
 * [0.0, 2.0] — https://ai.google.dev/api/generate-content (GenerationConfig.temperature, 2026-10-07'de kontrol edildi).
 * Seçilen değer istek gövdesine ve çalıştırma kaydının parameters.temperature alanına yazılır.
 */
export const GEMINI_TEMPERATURE_OPTIONS = [GEMINI_TEMPERATURE, 0] as const
export type GeminiTemperature = (typeof GEMINI_TEMPERATURE_OPTIONS)[number]

export function isGeminiTemperature(value: unknown): value is GeminiTemperature {
  return typeof value === 'number' && (GEMINI_TEMPERATURE_OPTIONS as readonly number[]).includes(value)
}

export function getClaudeModelOption(id: string): ClaudeModelOption | undefined {
  return CLAUDE_MODEL_OPTIONS.find((m) => m.id === id)
}

export function isProvider(value: unknown): value is Provider {
  return value === 'claude' || value === 'gemini'
}

export function isClaudeModelId(value: unknown): value is ClaudeModelId {
  return typeof value === 'string' && CLAUDE_MODEL_OPTIONS.some((m) => m.id === value)
}

export function isGeminiModelId(value: unknown): value is GeminiModelId {
  return typeof value === 'string' && GEMINI_MODEL_OPTIONS.some((m) => m.id === value)
}
