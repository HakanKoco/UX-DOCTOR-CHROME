// Yan panelden LLM analizi: service worker'a port üzerinden isteği gönderir, yanıtı doğrular.
import { QUOTA_KIND_LABELS, type GeminiDiagnostics } from '@/shared/geminiResponse'
import type { Inventory } from '@/shared/inventory'
import { requestParameters, type LlmRequest } from '@/shared/llmRequest'
import { LlmResponseError, evaluateAnswers, parseLlmResponse, type EvaluatedAnswers } from '@/shared/llmValidate'
import { LLM_PORT_NAME, type LlmCallSuccess, type LlmPortRequest, type LlmPortResponse } from '@/shared/messages'
import type { LlmResult } from '@/shared/report'
import { MAX_RETRIES, isRetryableStatus, remainingSeconds, retryDecision } from '@/shared/retry'
import { PROMPT_VERSION } from '@/shared/rubric'
import { callContent } from './tabBridge'

const PING_INTERVAL_MS = 20_000

/** Service worker'dan dönen hata; HTTP durumu biliniyorsa yeniden deneme kararı için taşınır. */
export class LlmCallError extends Error {
  readonly status: number | undefined
  readonly diagnostics: GeminiDiagnostics | undefined
  /** Yanıt gelmeden service worker bağlantısı koptu (istek işlenmiş olabilir; otomatik yeniden denenmez). */
  readonly disconnected: boolean
  constructor(message: string, status?: number, diagnostics?: GeminiDiagnostics, disconnected = false) {
    super(message)
    this.status = status
    this.diagnostics = diagnostics
    this.disconnected = disconnected
  }
}

/** Kullanıcı yeniden deneme beklemesini iptal etti. */
export class LlmCancelledError extends Error {
  constructor() {
    super('Bekleme iptal edildi.')
  }
}

/**
 * Hata "bekleyip sonra tekrar denenebilir" türden mi: geçici HTTP durumu (denemeler tükendi), kopan bağlantı ya da
 * kullanıcı iptali. Tutarlılık testinde bu hatalar çalıştırmayı başarısız saymaz, testi duraklatır.
 */
export function isTransientFailure(e: unknown): boolean {
  if (e instanceof LlmCancelledError) return true
  return e instanceof LlmCallError && (e.disconnected || isRetryableStatus(e.status))
}

/** Tek bir LLM çağrısı. Onay ekranında gösterilen gövdenin aynısı gönderilir. */
export function callLlm(request: LlmRequest): Promise<LlmCallSuccess> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const port = chrome.runtime.connect({ name: LLM_PORT_NAME })
    const ping = setInterval(() => port.postMessage({ type: 'ping' } satisfies LlmPortRequest), PING_INTERVAL_MS)
    const finish = () => {
      clearInterval(ping)
      port.disconnect()
    }
    port.onMessage.addListener((message: LlmPortResponse) => {
      if (message.type !== 'result' || message.requestId !== requestId) return
      finish()
      if (message.ok) resolve(message)
      else reject(new LlmCallError(message.error, message.status, message.diagnostics))
    })
    port.onDisconnect.addListener(() => {
      clearInterval(ping)
      reject(new LlmCallError('Service worker bağlantısı yanıt gelmeden koptu.', undefined, undefined, true))
    })
    port.postMessage({ type: 'run', requestId, request } satisfies LlmPortRequest)
  })
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Saniyede bir geri sayım bildirerek bekler; signal iptal edilirse LlmCancelledError ile biter. */
export function waitWithCountdown(ms: number, onTick: (secondsLeft: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new LlmCancelledError())
    const until = Date.now() + ms
    const tick = () => onTick(remainingSeconds(until, Date.now()))
    const cleanup = () => {
      clearInterval(interval)
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      reject(new LlmCancelledError())
    }
    const interval = setInterval(tick, 1000)
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort)
    tick()
  })
}

export interface RetryState {
  /** Kaçıncı yeniden deneme bekleniyor (1..maxRetries). */
  attempt: number
  maxRetries: number
  secondsLeft: number
  status: number | undefined
  /** server: Google'ın RetryInfo önerisi; exponential: kendi üstel beklememiz. */
  basis: 'server' | 'exponential'
  /** 429'da kota türünün Türkçe adı (ör. "dakikalık istek kotası (RPM)"). */
  quotaLabel: string | null
}

/**
 * 429/503(/529) hatalarında yeniden dener (karar: src/shared/retry.ts retryDecision); tek analizde ve tutarlılık
 * testinde kullanılır. Günlük kota dolduysa yeniden denenmez (hata hemen yukarı iletilir). Google bir bekleme
 * süresi önerdiyse (RetryInfo) o kullanılır, yoksa üstel bekleme. onWait bekleme sırasında saniyede bir çağrılır
 * (panelde "yeniden deneniyor (2/6), sonraki deneme X sn sonra"). signal ile bekleme iptal edilir.
 * Bekleme yan panelde yapılır; service worker her denemede yeni bir port bağlantısıyla uyandırılır.
 */
export async function callLlmWithRetry(
  request: LlmRequest,
  onWait: (state: RetryState) => void,
  signal?: AbortSignal,
): Promise<{ call: LlmCallSuccess; retries: number }> {
  for (let retries = 0; ; retries++) {
    if (signal?.aborted) throw new LlmCancelledError()
    try {
      return { call: await callLlm(request), retries }
    } catch (e) {
      if (!(e instanceof LlmCallError)) throw e
      const quota = e.diagnostics?.quota ?? null
      const decision = retryDecision(e.status, quota, retries)
      if (!decision.retry) throw e
      const attempt = retries + 1
      const quotaLabel = quota ? QUOTA_KIND_LABELS[quota.kind] : null
      await waitWithCountdown(
        decision.delayMs,
        (secondsLeft) =>
          onWait({ attempt, maxRetries: MAX_RETRIES, secondsLeft, status: e.status, basis: decision.basis, quotaLabel }),
        signal,
      )
    }
  }
}

/**
 * Çağrı sonucunu doğrular: şema → kimlik doğrulama (halüsinasyon) → seçicilerin sayfada yeniden aranması.
 * @param inventory Yerel envanter (gerçek seçicilerle).
 */
export async function buildLlmResult(
  call: LlmCallSuccess,
  request: LlmRequest,
  inventory: Inventory,
  tabId: number | null,
  retries = 0,
  manualFallback?: { fromModel: string; reason: string },
): Promise<LlmResult> {
  // Yanıt şemaya hiç uymuyorsa sonuç yine üretilir (ham yanıt çalıştırma kaydında kalsın), ama cevap/bulgu olmaz.
  let schemaError: string | undefined
  let evaluated: EvaluatedAnswers
  try {
    const parsed = parseLlmResponse(call.rawText)
    evaluated = evaluateAnswers(parsed.answers, inventory, parsed.malformed)
  } catch (e) {
    if (!(e instanceof LlmResponseError)) throw e
    schemaError = e.message
    evaluated = evaluateAnswers([], inventory)
  }

  // Otomatik kontrolün ikinci aşaması: bulgu seçicileri sayfada hâlâ tek bir öğeyle eşleşiyor mu?
  const selectors = [
    ...new Set(
      evaluated.findings.flatMap((f) => [f.selector, ...(f.evidence.relatedElements ?? []).map((r) => r.selector)]),
    ),
  ]
  if (tabId !== null && selectors.length > 0) {
    try {
      const checks = await callContent(tabId, 'checkSelectors', selectors)
      evaluated.hallucination.selectorCheck = {
        checked: checks.length,
        found: checks.filter((c) => c.count === 1).length,
        missing: checks.filter((c) => c.count !== 1).map((c) => c.selector),
      }
    } catch {
      // Sekme kapandıysa ikinci aşama atlanır; rapor bunu selectorCheck olmadan gösterir.
    }
  }

  return {
    run: {
      runId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      provider: request.provider,
      requestedModel: request.model,
      servedModel: call.servedModel,
      fallbackUsed: call.fallbackUsed,
      promptVersion: PROMPT_VERSION,
      parameters: requestParameters(request),
      retries,
      ...(manualFallback ? { manualFallback } : {}),
      stopReason: call.stopReason,
      durationMs: call.durationMs,
      usage: call.usage,
      rawResponse: call.rawText,
    },
    inventory: {
      includedCount: inventory.meta.includedCount,
      candidateCount: inventory.meta.candidateCount,
      truncated: inventory.meta.truncated,
      limit: inventory.meta.limit,
    },
    answers: evaluated.answers,
    findings: evaluated.findings,
    hallucination: evaluated.hallucination,
    missingQuestionIds: evaluated.missingQuestionIds,
    ignoredAnswers: evaluated.ignoredAnswers,
    malformedAnswers: evaluated.malformedAnswers,
    ...(schemaError ? { schemaError } : {}),
  }
}
