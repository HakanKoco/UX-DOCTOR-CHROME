// LLM çağrısı (yalnızca service worker'da). Gönderilen gövde, yan panelin onay ekranında gösterdiği
// gövdenin aynısıdır; burada yalnızca sağlayıcı/model doğrulanır, anahtar ve gerekli başlıklar eklenir.
import { requiredBetas, type ClaudeRequestBody, type LlmRequest } from '@/shared/llmRequest'
import type { LlmCallSuccess, LlmPortResponse } from '@/shared/messages'
import { isClaudeModelId, isGeminiModelId } from '@/shared/models'
import { apiErrorStatus, createClient, describeApiError } from './claudeClient'
import { GeminiHttpError, callGemini } from './geminiClient'

type CallOutcome = Omit<LlmCallSuccess, 'type' | 'requestId' | 'ok' | 'durationMs'>

async function runClaude(body: ClaudeRequestBody): Promise<CallOutcome> {
  const client = await createClient()
  const response = await client.beta.messages.create({ ...body, betas: requiredBetas(body) })

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category ?? 'belirtilmedi'
    throw new Error(`Model isteği reddetti (refusal, kategori: ${category}).`)
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Yanıt max_tokens sınırında kesildi; JSON eksik olabilir.')
  }
  const rawText = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const fallbackUsed =
    response.content.some((b) => b.type === 'fallback') ||
    (response.usage.iterations ?? []).some((i) => i.type === 'fallback_message')
  return {
    rawText,
    servedModel: response.model,
    fallbackUsed,
    stopReason: response.stop_reason,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens,
    },
  }
}

export async function runLlmCall(requestId: string, request: LlmRequest): Promise<LlmPortResponse> {
  const started = Date.now()
  try {
    let outcome: CallOutcome
    if (request.provider === 'claude') {
      if (!isClaudeModelId(request.body.model)) throw new Error(`İzin verilmeyen model: ${String(request.body.model)}`)
      outcome = await runClaude(request.body)
    } else if (request.provider === 'gemini') {
      if (!isGeminiModelId(request.model)) throw new Error(`İzin verilmeyen model: ${String(request.model)}`)
      outcome = { ...(await callGemini(request.model, request.body)), fallbackUsed: false }
    } else {
      throw new Error('Bilinmeyen LLM sağlayıcısı.')
    }
    return { type: 'result', requestId, ok: true, ...outcome, durationMs: Date.now() - started }
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      return { type: 'result', requestId, ok: false, error: error.message, status: error.status, diagnostics: error.diagnostics }
    }
    return { type: 'result', requestId, ok: false, error: describeApiError(error), status: apiErrorStatus(error) }
  }
}
