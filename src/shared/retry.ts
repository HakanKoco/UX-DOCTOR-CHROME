// Tutarlılık testinde ("aynı sayfayı N kez analiz et") istek sınırına takılmamak için bekleme ve yeniden deneme kuralları.
// Saf fonksiyonlar; birim testli (retry.test.ts).
//
// Kaynak (Gemini): https://ai.google.dev/gemini-api/docs/troubleshooting — 429 RESOURCE_EXHAUSTED ve 503 UNAVAILABLE
// için üstel bekleme ("1s, 2s, 4s, 8s"), rastgele sapma (jitter) ve deneme sayısına üst sınır önerilir; 400/403 gibi
// kalıcı hatalar yeniden denenmez. Ücretsiz katmanın sayısal sınırları dokümanda yayımlanmaz (AI Studio'da görülür),
// bu yüzden çalıştırmalar arası bekleme sabit ve temkinli tutuldu.
import type { Provider } from './models'

/** Çalıştırmalar arası bekleme (ms). Claude'da önceki davranış korunur (bekleme yok). */
export const RUN_INTERVAL_MS: Record<Provider, number> = { claude: 0, gemini: 15_000 }

export const MAX_RETRIES = 4
export const RETRY_BASE_DELAY_MS = 2_000
export const RETRY_MAX_DELAY_MS = 60_000
export const RETRY_JITTER_MS = 1_000

/**
 * Geçici sayılan HTTP durumları: 429 (istek sınırı), 503 (geçici olarak kullanılamıyor) ve
 * Claude'a özgü 529 (overloaded). Bu durumlarda istek işlenmemiştir; yeniden göndermek sayfa verisini fazladan işletmez.
 */
export function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || status === 503 || status === 529
}

/**
 * attempt. yeniden denemeden önce beklenecek süre (attempt 1'den başlar): 2s, 4s, 8s, 16s (+ 0–1 s rastgele sapma),
 * en çok 60 s. random parametresi testte sabitlenebilsin diye dışarıdan verilir.
 */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const exponential = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  return Math.min(RETRY_MAX_DELAY_MS, exponential + Math.floor(random() * RETRY_JITTER_MS))
}

/** attempt. denemeden sonra (başarısızsa) yeniden denenmeli mi. */
export function shouldRetry(status: number | undefined, retriesSoFar: number): boolean {
  return isRetryableStatus(status) && retriesSoFar < MAX_RETRIES
}
