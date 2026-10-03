// Yan panel / ayarlar sayfası ile service worker arasındaki mesaj sözleşmesi.

export interface VerifyKeyRequest {
  type: 'verify-key'
}

export interface VerifyKeyResponse {
  ok: boolean
  /** Kullanıcıya gösterilecek Türkçe açıklama. Anahtarın kendisi asla içerilmez. */
  message: string
}

export type BackgroundRequest = VerifyKeyRequest

export function sendToBackground(request: VerifyKeyRequest): Promise<VerifyKeyResponse>
export function sendToBackground(request: BackgroundRequest): Promise<unknown> {
  return chrome.runtime.sendMessage(request)
}
