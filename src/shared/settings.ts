// Kullanıcı ayarları chrome.storage.local içinde tutulur (sync değil: anahtar cihazdan çıkmaz).
// API anahtarları hiçbir yerde loglanmaz. Her sağlayıcının anahtarı ayrı tutulur.
import {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_PROVIDER,
  isClaudeModelId,
  isGeminiModelId,
  isProvider,
  type ClaudeModelId,
  type GeminiModelId,
  type ModelId,
  type Provider,
} from './models'

// Claude anahtarı ve modeli için eski adlar korunur (önceden kaydedilmiş ayarlar bozulmaz).
const KEY_PROVIDER = 'provider'
const KEY_CLAUDE_API = 'apiKey'
const KEY_CLAUDE_MODEL = 'model'
const KEY_GEMINI_API = 'geminiApiKey'
const KEY_GEMINI_MODEL = 'geminiModel'

const API_KEY_FIELDS: Record<Provider, string> = { claude: KEY_CLAUDE_API, gemini: KEY_GEMINI_API }

export interface PublicSettings {
  provider: Provider
  claudeModel: ClaudeModelId
  geminiModel: GeminiModelId
  hasClaudeKey: boolean
  hasGeminiKey: boolean
  /** Seçili sağlayıcının modeli. */
  model: ModelId
  /** Seçili sağlayıcının anahtarı kayıtlı mı. */
  hasApiKey: boolean
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await chrome.storage.local.get([KEY_PROVIDER, KEY_CLAUDE_API, KEY_CLAUDE_MODEL, KEY_GEMINI_API, KEY_GEMINI_MODEL])
  const provider = isProvider(s[KEY_PROVIDER]) ? s[KEY_PROVIDER] : DEFAULT_PROVIDER
  const claudeModel = isClaudeModelId(s[KEY_CLAUDE_MODEL]) ? s[KEY_CLAUDE_MODEL] : DEFAULT_CLAUDE_MODEL
  const geminiModel = isGeminiModelId(s[KEY_GEMINI_MODEL]) ? s[KEY_GEMINI_MODEL] : DEFAULT_GEMINI_MODEL
  const hasClaudeKey = nonEmpty(s[KEY_CLAUDE_API])
  const hasGeminiKey = nonEmpty(s[KEY_GEMINI_API])
  return {
    provider,
    claudeModel,
    geminiModel,
    hasClaudeKey,
    hasGeminiKey,
    model: provider === 'claude' ? claudeModel : geminiModel,
    hasApiKey: provider === 'claude' ? hasClaudeKey : hasGeminiKey,
  }
}

/**
 * Yapıştırma sırasında gelen baştaki/sondaki boşlukları, satır sonlarını, sıfır genişlikli boşlukları ve BOM'u kırpar.
 * Anahtarın içindeki karakterlere dokunmaz.
 */
export function normalizeApiKey(value: string): string {
  return value.replace(/^[\s\u200B\u200C\u200D\uFEFF]+|[\s\u200B\u200C\u200D\uFEFF]+$/g, '')
}

/** Yalnızca service worker (LLM çağrısı) kullanır. */
export async function getApiKey(provider: Provider): Promise<string | null> {
  const field = API_KEY_FIELDS[provider]
  const stored = await chrome.storage.local.get(field)
  // Daha önce kırpılmadan kaydedilmiş anahtarlar için okurken de kırpılır.
  const key = typeof stored[field] === 'string' ? normalizeApiKey(stored[field]) : ''
  return key.length > 0 ? key : null
}

export async function saveApiKey(provider: Provider, apiKey: string): Promise<void> {
  await chrome.storage.local.set({ [API_KEY_FIELDS[provider]]: normalizeApiKey(apiKey) })
}

export async function deleteApiKey(provider: Provider): Promise<void> {
  await chrome.storage.local.remove(API_KEY_FIELDS[provider])
}

export async function saveProvider(provider: Provider): Promise<void> {
  await chrome.storage.local.set({ [KEY_PROVIDER]: provider })
}

export async function saveClaudeModel(model: ClaudeModelId): Promise<void> {
  await chrome.storage.local.set({ [KEY_CLAUDE_MODEL]: model })
}

export async function saveGeminiModel(model: GeminiModelId): Promise<void> {
  await chrome.storage.local.set({ [KEY_GEMINI_MODEL]: model })
}

/**
 * Anahtarın biçimini kaba olarak denetler; anahtarın kendisini asla göstermez.
 * Claude anahtarları "sk-ant-" ile başlar. Gemini anahtarının biçimi resmi dokümanda tanımlanmadığı için
 * yalnızca boş olmama, makul uzunluk ve boşluk içermeme denetlenir; asıl doğrulama "Anahtarı doğrula" ile yapılır.
 */
export function looksLikeApiKey(provider: Provider, value: string): boolean {
  const v = normalizeApiKey(value)
  if (v.length <= 20 || /\s/.test(v)) return false
  return provider === 'claude' ? v.startsWith('sk-ant-') : true
}

const PROVIDER_KEY_NAMES: Record<Provider, string> = { claude: 'Claude API', gemini: 'Gemini API' }

/**
 * Seçili sağlayıcının anahtar durumu (saf fonksiyon). Ayarlar sayfası, yan panel özeti ve "LLM gönderimi kapalı"
 * gerekçesi bu tek kaynaktan beslenir; böylece Gemini seçiliyken Claude anahtarının durumu gösterilmez.
 */
export function keyStatus(settings: Pick<PublicSettings, 'provider' | 'hasClaudeKey' | 'hasGeminiKey'>): {
  ok: boolean
  text: string
} {
  const name = PROVIDER_KEY_NAMES[settings.provider]
  const has = settings.provider === 'claude' ? settings.hasClaudeKey : settings.hasGeminiKey
  return has
    ? { ok: true, text: `Seçili sağlayıcı: ${name} — anahtar kayıtlı.` }
    : { ok: false, text: `Seçili sağlayıcı: ${name} — anahtar ayarlanmamış. Ayarlar sayfasından ${name} anahtarını girin.` }
}
