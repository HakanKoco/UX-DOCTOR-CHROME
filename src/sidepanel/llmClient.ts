// Yan panelden LLM analizi: service worker'a port üzerinden gövdeyi gönderir, yanıtı doğrular.
import type { Inventory } from '@/shared/inventory'
import type { LlmRequestBody } from '@/shared/llmRequest'
import { evaluateAnswers, parseLlmResponse } from '@/shared/llmValidate'
import { LLM_PORT_NAME, type LlmCallSuccess, type LlmPortRequest, type LlmPortResponse } from '@/shared/messages'
import type { LlmResult } from '@/shared/report'
import { PROMPT_VERSION } from '@/shared/rubric'
import { callContent } from './tabBridge'

const PING_INTERVAL_MS = 20_000

/** Tek bir LLM çağrısı. Onay ekranında gösterilen gövdenin aynısı gönderilir. */
export function callLlm(body: LlmRequestBody): Promise<LlmCallSuccess> {
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
      else reject(new Error(message.error))
    })
    port.onDisconnect.addListener(() => {
      clearInterval(ping)
      reject(new Error('Service worker bağlantısı koptu.'))
    })
    port.postMessage({ type: 'run', requestId, body } satisfies LlmPortRequest)
  })
}

/**
 * Çağrı sonucunu doğrular: şema → kimlik doğrulama (halüsinasyon) → seçicilerin sayfada yeniden aranması.
 * @param inventory Yerel envanter (gerçek seçicilerle).
 */
export async function buildLlmResult(
  call: LlmCallSuccess,
  body: LlmRequestBody,
  inventory: Inventory,
  tabId: number | null,
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
      requestedModel: body.model,
      servedModel: call.servedModel,
      fallbackUsed: call.fallbackUsed,
      promptVersion: PROMPT_VERSION,
      parameters: {
        maxTokens: body.max_tokens,
        ...(body.output_config.effort ? { effort: body.output_config.effort } : {}),
        ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
        ...(body.fallbacks ? { fallbacks: body.fallbacks } : {}),
      },
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
