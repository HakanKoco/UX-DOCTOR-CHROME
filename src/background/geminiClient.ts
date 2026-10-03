// Gemini API çağrısı (yalnızca service worker'da). SDK kullanılmaz: gövde, onay ekranında gösterilen nesnenin
// aynısı olarak fetch ile gönderilir. Anahtar yalnızca x-goog-api-key başlığına konur (URL'ye değil), loglanmaz.
// Kaynak: https://ai.google.dev/api/generate-content, https://ai.google.dev/api/models (models.get).
import { describeGeminiHttpError, parseGeminiResponse } from '@/shared/geminiResponse'
import { GEMINI_API_BASE, geminiGenerateUrl, type GeminiRequestBody } from '@/shared/llmRequest'
import type { GeminiModelId } from '@/shared/models'
import { getApiKey } from '@/shared/settings'
import { MissingApiKeyError } from './claudeClient'

const TIMEOUT_MS = 5 * 60 * 1000

export class GeminiHttpError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function requireKey(): Promise<string> {
  const apiKey = await getApiKey('gemini')
  if (!apiKey) throw new MissingApiKeyError('Gemini API')
  return apiKey
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function describeNetworkError(error: unknown): string {
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'İstek zaman aşımına uğradı.'
  }
  return 'Gemini API sunucusuna bağlanılamadı.'
}

export interface GeminiCallResult {
  rawText: string
  servedModel: string
  stopReason: string | null
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number | null } | null
}

export async function callGemini(model: GeminiModelId, body: GeminiRequestBody): Promise<GeminiCallResult> {
  const apiKey = await requireKey()
  let response: Response
  try {
    response = await fetch(geminiGenerateUrl(model), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new Error(describeNetworkError(error))
  }
  const data = await readJson(response)
  if (!response.ok) throw new GeminiHttpError(describeGeminiHttpError(response.status, data, apiKey), response.status)
  const parsed = parseGeminiResponse(data, model)
  if (!parsed.ok) throw new Error(parsed.error)
  return { rawText: parsed.rawText, servedModel: parsed.servedModel, stopReason: parsed.stopReason, usage: parsed.usage }
}

/** models.get: modelin bilgisini sorgular (sayfa verisi göndermez, içerik üretmez). */
export async function getGeminiModelInfo(model: GeminiModelId): Promise<{ name: string; displayName: string }> {
  const apiKey = await requireKey()
  let response: Response
  try {
    response = await fetch(`${GEMINI_API_BASE}/models/${model}`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (error) {
    throw new Error(describeNetworkError(error))
  }
  const data = (await readJson(response)) as { name?: unknown; displayName?: unknown } | null
  if (!response.ok) throw new GeminiHttpError(describeGeminiHttpError(response.status, data, apiKey), response.status)
  return {
    name: typeof data?.name === 'string' ? data.name : `models/${model}`,
    displayName: typeof data?.displayName === 'string' ? data.displayName : model,
  }
}
