// Kullanıcı ayarları chrome.storage.local içinde tutulur (sync değil: anahtar cihazdan çıkmaz).
// API anahtarı hiçbir yerde loglanmaz.
import { DEFAULT_MODEL, isModelId, type ModelId } from './models'

const KEY_API = 'apiKey'
const KEY_MODEL = 'model'

export interface PublicSettings {
  model: ModelId
  hasApiKey: boolean
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const stored = await chrome.storage.local.get([KEY_API, KEY_MODEL])
  return {
    model: isModelId(stored[KEY_MODEL]) ? stored[KEY_MODEL] : DEFAULT_MODEL,
    hasApiKey: typeof stored[KEY_API] === 'string' && stored[KEY_API].length > 0,
  }
}

/** Yalnızca service worker (LLM çağrısı) ve ayarlar sayfası kullanır. */
export async function getApiKey(): Promise<string | null> {
  const stored = await chrome.storage.local.get(KEY_API)
  const key = stored[KEY_API]
  return typeof key === 'string' && key.length > 0 ? key : null
}

export async function saveApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ [KEY_API]: apiKey.trim() })
}

export async function deleteApiKey(): Promise<void> {
  await chrome.storage.local.remove(KEY_API)
}

export async function saveModel(model: ModelId): Promise<void> {
  await chrome.storage.local.set({ [KEY_MODEL]: model })
}

/** Anahtarın biçimini kaba olarak denetler; anahtarın kendisini asla göstermez. */
export function looksLikeApiKey(value: string): boolean {
  const v = value.trim()
  return v.startsWith('sk-ant-') && v.length > 20 && !/\s/.test(v)
}
