// Yan panel / ayarlar sayfası ile service worker arasındaki mesaj sözleşmesi.
import type { LlmRequest } from './llmRequest'
import type { Provider } from './models'

export interface VerifyKeyRequest {
  type: 'verify-key'
  provider: Provider
}

export interface VerifyKeyResponse {
  ok: boolean
  /** Kullanıcıya gösterilecek Türkçe açıklama. Anahtarın kendisi asla içerilmez. */
  message: string
  /** Hangi sağlayıcının anahtarının doğrulandığı (service worker geri yansıtır). */
  provider?: Provider
}

export type BackgroundRequest = VerifyKeyRequest

export function sendToBackground(request: VerifyKeyRequest): Promise<VerifyKeyResponse | undefined>
export function sendToBackground(request: BackgroundRequest): Promise<unknown> {
  return chrome.runtime.sendMessage(request)
}

export const STALE_WORKER_MESSAGE =
  "Arka plan betiği (service worker) eski sürümde çalışıyor ya da yanıt başka bir sağlayıcıya ait. chrome://extensions sayfasında UX Doktor için Yenile'ye basın ve tekrar deneyin."

/**
 * Doğrulama yanıtını, istenen sağlayıcıyla eşleşiyor mu diye denetler.
 * Chrome'da ayarlar sayfası yeniden yükleme gerektirmez ama service worker gerektirir; yeni build'den sonra eklenti
 * yenilenmezse yeni ayarlar sayfası eski service worker'la konuşur. Eski sürüm `provider` alanını bilmediği için
 * yanıtında da yoktur: bu durumda yanıt güvenilmez sayılır ve kullanıcıya eklentiyi yenilemesi söylenir.
 */
export function interpretVerifyResponse(requested: Provider, response: VerifyKeyResponse | undefined): VerifyKeyResponse {
  if (!response || response.provider !== requested) return { ok: false, message: STALE_WORKER_MESSAGE, provider: requested }
  return response
}

// --- LLM çağrısı: uzun sürebileceği için port üzerinden; panel düzenli "ping" atarak service worker'ı uyanık tutar.

export const LLM_PORT_NAME = 'llm'

export type LlmPortRequest = { type: 'run'; requestId: string; request: LlmRequest } | { type: 'ping' }

export interface LlmCallSuccess {
  type: 'result'
  requestId: string
  ok: true
  rawText: string
  servedModel: string
  fallbackUsed: boolean
  stopReason: string | null
  durationMs: number
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number | null } | null
}

export interface LlmCallFailure {
  type: 'result'
  requestId: string
  ok: false
  error: string
  /** HTTP durumu (biliniyorsa); yan panel 429/503'te yeniden deneme kararını buna göre verir. */
  status?: number
}

export type LlmPortResponse = LlmCallSuccess | LlmCallFailure
