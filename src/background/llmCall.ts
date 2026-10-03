// Claude API çağrısı (yalnızca service worker'da). Gönderilen gövde, yan panelin onay ekranında gösterdiği
// gövdenin aynısıdır; burada yalnızca model doğrulanır ve gerekli beta başlığı eklenir.
import { requiredBetas, type LlmRequestBody } from '@/shared/llmRequest'
import type { LlmPortResponse } from '@/shared/messages'
import { isModelId } from '@/shared/models'
import { createClient, describeApiError } from './claudeClient'

export async function runLlmCall(requestId: string, body: LlmRequestBody): Promise<LlmPortResponse> {
  const started = Date.now()
  try {
    if (!isModelId(body.model)) throw new Error(`İzin verilmeyen model: ${String(body.model)}`)
    const client = await createClient()
    const response = await client.beta.messages.create({ ...body, betas: requiredBetas(body) })

    if (response.stop_reason === 'refusal') {
      const category = response.stop_details?.category ?? 'belirtilmedi'
      return { type: 'result', requestId, ok: false, error: `Model isteği reddetti (refusal, kategori: ${category}).` }
    }
    if (response.stop_reason === 'max_tokens') {
      return { type: 'result', requestId, ok: false, error: 'Yanıt max_tokens sınırında kesildi; JSON eksik olabilir.' }
    }
    const rawText = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const fallbackUsed =
      response.content.some((b) => b.type === 'fallback') ||
      (response.usage.iterations ?? []).some((i) => i.type === 'fallback_message')
    return {
      type: 'result',
      requestId,
      ok: true,
      rawText,
      servedModel: response.model,
      fallbackUsed,
      stopReason: response.stop_reason,
      durationMs: Date.now() - started,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens,
      },
    }
  } catch (error) {
    return { type: 'result', requestId, ok: false, error: describeApiError(error) }
  }
}
