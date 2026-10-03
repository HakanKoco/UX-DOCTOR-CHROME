import Anthropic from '@anthropic-ai/sdk'
import { getApiKey } from '@/shared/settings'

export class MissingApiKeyError extends Error {
  constructor() {
    super('API anahtarı ayarlanmamış. Ayarlar sayfasından anahtarınızı girin.')
  }
}

/**
 * Anahtarı her çağrıda storage'dan okuyup istemci oluşturur; anahtar bellekte global tutulmaz.
 * dangerouslyAllowBrowser: SDK bu seçenekle `anthropic-dangerous-direct-browser-access: true`
 * başlığını ekler (tarayıcıdan doğrudan erişim / CORS için gerekli başlık).
 * maxRetries 0: aynı isteğin habersiz tekrar gönderilmesini istemiyoruz; kullanıcı onayladığı kadar istek gider.
 */
export async function createClient(): Promise<Anthropic> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new MissingApiKeyError()
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 5 * 60 * 1000 })
}

/** SDK hatalarını kullanıcıya gösterilecek Türkçe metne çevirir. Anahtar metne asla eklenmez. */
export function describeApiError(error: unknown): string {
  if (error instanceof MissingApiKeyError) return error.message
  if (error instanceof Anthropic.AuthenticationError) return 'API anahtarı geçersiz (401).'
  if (error instanceof Anthropic.PermissionDeniedError) return 'Bu anahtarın seçilen modele erişim izni yok (403).'
  if (error instanceof Anthropic.NotFoundError) return 'Model bulunamadı (404). Ayarlardan başka bir model seçin.'
  if (error instanceof Anthropic.RateLimitError) return 'İstek sınırına takıldınız (429). Biraz bekleyip tekrar deneyin.'
  if (error instanceof Anthropic.BadRequestError) return `İstek reddedildi (400): ${error.message}`
  if (error instanceof Anthropic.APIConnectionTimeoutError) return 'İstek zaman aşımına uğradı.'
  if (error instanceof Anthropic.APIConnectionError) return 'Claude API sunucusuna bağlanılamadı.'
  if (error instanceof Anthropic.APIError) return `API hatası (${error.status ?? '?'}): ${error.message}`
  return error instanceof Error ? error.message : String(error)
}
