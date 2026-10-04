// Tutarlılık testinin ilerleme kaydı: her biten çalıştırma chrome.storage.local'e yazılır. 503/429 denemeleri
// tükenirse, kullanıcı iptal ederse ya da panel kapanırsa test "yarım" kalır ve kaldığı yerden devam ettirilebilir.
//
// Kayıtta yalnızca zaten onay ekranında gösterilmiş veriler ve yanıtlar vardır: maskelenmiş envanter, istek gövdesi
// (API anahtarı yok), LLM sonuçları. Veri bu cihazdan çıkmaz; yeni test başlatılınca ya da "Kaydı sil" ile silinir.
// Kaynak (kota: storage.local 10 MB): https://developer.chrome.com/docs/extensions/reference/api/storage
import type { PageInfo } from './contentApi'
import type { Inventory } from './inventory'
import type { LlmRequest } from './llmRequest'
import type { LlmResult } from './report'
import type { ConsistencyFailure } from './validationExports'

export const CONSISTENCY_PROGRESS_KEY = 'consistencyProgress'
export const CONSISTENCY_PROGRESS_VERSION = 1

export interface ConsistencyProgress {
  version: typeof CONSISTENCY_PROGRESS_VERSION
  testId: string
  startedAt: string
  updatedAt: string
  page: PageInfo
  /** Tüm çalıştırmalarda gönderilen aynı istek (onay ekranında gösterilen). */
  request: LlmRequest
  inventory: Inventory
  requestedRuns: number
  results: { runIndex: number; result: LlmResult }[]
  failures: ConsistencyFailure[]
  /** Test neden durdu (denemeler tükendi, kullanıcı iptal etti…); tamamlanmış ya da sürüyorsa yok. */
  pausedReason?: string
}

export function newProgress(input: {
  page: PageInfo
  request: LlmRequest
  inventory: Inventory
  requestedRuns: number
  now?: string
  testId?: string
}): ConsistencyProgress {
  const now = input.now ?? new Date().toISOString()
  return {
    version: CONSISTENCY_PROGRESS_VERSION,
    testId: input.testId ?? crypto.randomUUID(),
    startedAt: now,
    updatedAt: now,
    page: input.page,
    request: input.request,
    inventory: input.inventory,
    requestedRuns: input.requestedRuns,
    results: [],
    failures: [],
  }
}

/** Biten (başarılı ya da kalıcı hatayla başarısız) çalıştırma sayısı. */
export function attemptedRuns(p: ConsistencyProgress): number {
  return p.results.length + p.failures.length
}

/** Sıradaki çalıştırmanın numarası (1'den başlar). */
export function nextRunIndex(p: ConsistencyProgress): number {
  return attemptedRuns(p) + 1
}

export function remainingRuns(p: ConsistencyProgress): number {
  return Math.max(0, p.requestedRuns - attemptedRuns(p))
}

export function isComplete(p: ConsistencyProgress): boolean {
  return remainingRuns(p) === 0
}

export function withResult(p: ConsistencyProgress, runIndex: number, result: LlmResult): ConsistencyProgress {
  const { pausedReason: _drop, ...rest } = p
  return { ...rest, results: [...p.results, { runIndex, result }], updatedAt: new Date().toISOString() }
}

export function withFailure(p: ConsistencyProgress, failure: ConsistencyFailure): ConsistencyProgress {
  const { pausedReason: _drop, ...rest } = p
  return { ...rest, failures: [...p.failures, failure], updatedAt: new Date().toISOString() }
}

export function withPause(p: ConsistencyProgress, reason: string): ConsistencyProgress {
  return { ...p, pausedReason: reason, updatedAt: new Date().toISOString() }
}

/** Devam ederken URL karşılaştırması: parça (#…) yok sayılır. */
export function samePage(a: string, b: string): boolean {
  const strip = (u: string) => u.split('#')[0]
  return strip(a) === strip(b)
}

/** Depodan okunan değerin bu sürümün kaydı olup olmadığı (bozuk/eski kayıt yok sayılır). */
export function isConsistencyProgress(value: unknown): value is ConsistencyProgress {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<ConsistencyProgress>
  return (
    v.version === CONSISTENCY_PROGRESS_VERSION &&
    typeof v.testId === 'string' &&
    typeof v.requestedRuns === 'number' &&
    Array.isArray(v.results) &&
    Array.isArray(v.failures) &&
    !!v.page &&
    !!v.request &&
    !!v.inventory
  )
}

export async function loadProgress(): Promise<ConsistencyProgress | null> {
  const stored = await chrome.storage.local.get(CONSISTENCY_PROGRESS_KEY)
  const value: unknown = stored[CONSISTENCY_PROGRESS_KEY]
  return isConsistencyProgress(value) ? value : null
}

export async function saveProgress(p: ConsistencyProgress): Promise<void> {
  await chrome.storage.local.set({ [CONSISTENCY_PROGRESS_KEY]: p })
}

export async function clearProgress(): Promise<void> {
  await chrome.storage.local.remove(CONSISTENCY_PROGRESS_KEY)
}
