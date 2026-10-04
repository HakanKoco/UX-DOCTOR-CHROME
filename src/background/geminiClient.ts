// Gemini API çağrısı (yalnızca service worker'da). SDK kullanılmaz: gövde, onay ekranında gösterilen nesnenin
// aynısı olarak fetch ile gönderilir. Anahtar yalnızca x-goog-api-key başlığına konur (URL'ye değil), loglanmaz.
// Kaynak: https://ai.google.dev/api/generate-content, https://ai.google.dev/api/models (models.get).
import {
  buildGeminiDiagnostics,
  describeGeminiHttpError,
  parseGeminiResponse,
  type GeminiDiagnostics,
} from '@/shared/geminiResponse'
import { GEMINI_API_BASE, geminiGenerateUrl, type GeminiRequestBody } from '@/shared/llmRequest'
import type { GeminiModelId } from '@/shared/models'
import { getApiKey } from '@/shared/settings'
import { MissingApiKeyError } from './claudeClient'
import type { LlmUsage } from '@/shared/report'

const TIMEOUT_MS = 5 * 60 * 1000

/** HTTP hatası; teşhis bilgisi anahtarın kendisini içermez (yalnızca kaba biçim sınıfı ve uzunluk). */
export class GeminiHttpError extends Error {
  readonly status: number
  readonly diagnostics: GeminiDiagnostics
  constructor(message: string, diagnostics: GeminiDiagnostics) {
    super(message)
    this.status = diagnostics.httpStatus
    this.diagnostics = diagnostics
  }
}

function httpError(url: string, response: Response, body: unknown, apiKey: string, model: GeminiModelId): GeminiHttpError {
  const diagnostics = buildGeminiDiagnostics({
    httpStatus: response.status,
    body,
    endpointPath: new URL(url).pathname,
    model,
    apiKey,
  })
  return new GeminiHttpError(describeGeminiHttpError(response.status, body, apiKey), diagnostics)
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
  usage: LlmUsage | null
}

export async function callGemini(model: GeminiModelId, body: GeminiRequestBody): Promise<GeminiCallResult> {
  const apiKey = await requireKey()
  const url = geminiGenerateUrl(model)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new Error(describeNetworkError(error))
  }
  const data = await readJson(response)
  if (!response.ok) throw httpError(url, response, data, apiKey, model)
  const parsed = parseGeminiResponse(data, model)
  if (!parsed.ok) throw new Error(parsed.error)
  return { rawText: parsed.rawText, servedModel: parsed.servedModel, stopReason: parsed.stopReason, usage: parsed.usage }
}

/** models.get: modelin bilgisini sorgular (sayfa verisi göndermez, içerik üretmez). */
export async function getGeminiModelInfo(model: GeminiModelId): Promise<{ name: string; displayName: string }> {
  const apiKey = await requireKey()
  const url = `${GEMINI_API_BASE}/models/${model}`
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (error) {
    throw new Error(describeNetworkError(error))
  }
  const data = (await readJson(response)) as { name?: unknown; displayName?: unknown } | null
  if (!response.ok) throw httpError(url, response, data, apiKey, model)
  return {
    name: typeof data?.name === 'string' ? data.name : `models/${model}`,
    displayName: typeof data?.displayName === 'string' ? data.displayName : model,
  }
}
