// Yan panelden LLM analizi: service worker'a port üzerinden isteği gönderir, yanıtı doğrular.
import type { Inventory } from '@/shared/inventory'
import { requestParameters, type LlmRequest } from '@/shared/llmRequest'
import { evaluateAnswers, parseLlmResponse } from '@/shared/llmValidate'
import { LLM_PORT_NAME, type LlmCallSuccess, type LlmPortRequest, type LlmPortResponse } from '@/shared/messages'
import type { LlmResult } from '@/shared/report'
import { retryDelayMs, shouldRetry } from '@/shared/retry'
import { PROMPT_VERSION } from '@/shared/rubric'
import { callContent } from './tabBridge'

const PING_INTERVAL_MS = 20_000

/** Service worker'dan dönen hata; HTTP durumu biliniyorsa yeniden deneme kararı için taşınır. */
export class LlmCallError extends Error {
  readonly status: number | undefined
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
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
      else reject(new LlmCallError(message.error, message.status))
    })
    port.onDisconnect.addListener(() => {
      clearInterval(ping)
      reject(new LlmCallError('Service worker bağlantısı koptu.'))
    })
    port.postMessage({ type: 'run', requestId, request } satisfies LlmPortRequest)
  })
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Tutarlılık testi için: 429/503(/529) hatalarında üstel bekleme ile yeniden dener (src/shared/retry.ts).
 * Diğer hatalar hemen yukarı iletilir. onRetry, kullanıcıya bekleme durumunu göstermek içindir.
 */
export async function callLlmWithRetry(
  request: LlmRequest,
  onRetry: (attempt: number, delayMs: number, error: LlmCallError) => void,
): Promise<{ call: LlmCallSuccess; retries: number }> {
  for (let retries = 0; ; retries++) {
    try {
      return { call: await callLlm(request), retries }
    } catch (e) {
      if (!(e instanceof LlmCallError) || !shouldRetry(e.status, retries)) throw e
      const delay = retryDelayMs(retries + 1)
      onRetry(retries + 1, delay, e)
      await wait(delay)
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
): Promise<LlmResult> {
  const evaluated = evaluateAnswers(parseLlmResponse(call.rawText), inventory)

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
  }
}
