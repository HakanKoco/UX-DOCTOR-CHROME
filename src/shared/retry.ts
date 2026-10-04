// LLM çağrılarında (tek analiz ve tutarlılık testi) geçici hatalara karşı bekleme ve yeniden deneme kuralları.
// Saf fonksiyonlar; birim testli (retry.test.ts).
//
// Kaynak (Gemini): https://ai.google.dev/gemini-api/docs/troubleshooting — 429 RESOURCE_EXHAUSTED ve 503 UNAVAILABLE
// için üstel bekleme ("1s, 2s, 4s, 8s"), rastgele sapma (jitter) ve deneme sayısına üst sınır önerilir; 400/403 gibi
// kalıcı hatalar yeniden denenmez. Ücretsiz katmanın sayısal sınırları dokümanda yayımlanmaz (AI Studio'da görülür),
// bu yüzden çalıştırmalar arası bekleme sabit ve temkinli tutuldu.
//
// Dokümandaki örnekten (SDK: 4 deneme, en çok 60 sn) daha uzun bekliyoruz: ücretsiz katmanda 503 dakikalarca
// sürebiliyor (gerçek kullanımda 4 deneme yetmedi). Bekleme yan panelde geri sayımla gösterilir ve kullanıcı
// istediği an iptal edebilir; toplam bekleme en çok ≈ 4,6 dk'dır (5+10+20+40+80+120 sn + sapma).
import type { Provider } from './models'

/** Çalıştırmalar arası bekleme (ms). Claude'da önceki davranış korunur (bekleme yok). */
export const RUN_INTERVAL_MS: Record<Provider, number> = { claude: 0, gemini: 15_000 }

export const MAX_RETRIES = 6
export const RETRY_BASE_DELAY_MS = 5_000
export const RETRY_MAX_DELAY_MS = 120_000
export const RETRY_JITTER_MS = 1_000

/**
 * Geçici sayılan HTTP durumları: 429 (istek sınırı), 503 (geçici olarak kullanılamıyor) ve
 * Claude'a özgü 529 (overloaded). Bu durumlarda istek işlenmemiştir; yeniden göndermek sayfa verisini fazladan işletmez.
 */
export function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || status === 503 || status === 529
}

/**
 * attempt. yeniden denemeden önce beklenecek süre (attempt 1'den başlar): 5s, 10s, 20s, 40s, 80s, 120s
 * (+ 0–1 s rastgele sapma), en çok 120 s. random parametresi testte sabitlenebilsin diye dışarıdan verilir.
 */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const exponential = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  return Math.min(RETRY_MAX_DELAY_MS, exponential + Math.floor(random() * RETRY_JITTER_MS))
}

/** attempt. denemeden sonra (başarısızsa) yeniden denenmeli mi. */
export function shouldRetry(status: number | undefined, retriesSoFar: number): boolean {
  return isRetryableStatus(status) && retriesSoFar < MAX_RETRIES
}

/** Google'ın önerdiği bekleme bundan uzunsa beklenmez; kullanıcıya söylenip durulur (panel saatlerce bekletilmez). */
export const MAX_SERVER_RETRY_DELAY_MS = 10 * 60_000

export type RetryDecision =
  | { retry: true; delayMs: number; basis: 'server' | 'exponential' }
  | { retry: false; reason: 'not-retryable' | 'exhausted' | 'daily-quota' | 'delay-too-long' }

/**
 * Yeniden deneme kararı (429 kota ayrıntısını dikkate alır; ayrıntı src/shared/geminiResponse.ts parseQuotaInfo):
 * - günlük kota (rpd): aynı gün yeniden denemek kotayı daha da harcar → durulur,
 * - Google RetryInfo.retryDelay verdiyse o kadar (+ 0–1 s sapma) beklenir; 10 dk'yı aşıyorsa durulur,
 * - aksi halde mevcut üstel bekleme (5 s … 120 s).
 */
export function retryDecision(
  status: number | undefined,
  quota: { kind: string; retryDelayMs: number | null } | null | undefined,
  retriesSoFar: number,
  random: () => number = Math.random,
): RetryDecision {
  if (!isRetryableStatus(status)) return { retry: false, reason: 'not-retryable' }
  if (status === 429 && quota?.kind === 'rpd') return { retry: false, reason: 'daily-quota' }
  if (retriesSoFar >= MAX_RETRIES) return { retry: false, reason: 'exhausted' }
  if (status === 429 && quota?.retryDelayMs != null) {
    if (quota.retryDelayMs > MAX_SERVER_RETRY_DELAY_MS) return { retry: false, reason: 'delay-too-long' }
    return { retry: true, delayMs: quota.retryDelayMs + Math.floor(random() * RETRY_JITTER_MS), basis: 'server' }
  }
  return { retry: true, delayMs: retryDelayMs(retriesSoFar + 1, random), basis: 'exponential' }
}

/** Geri sayım metni için kalan saniye (yukarı yuvarlanır; 0'ın altına inmez). */
export function remainingSeconds(untilMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((untilMs - nowMs) / 1000))
}
