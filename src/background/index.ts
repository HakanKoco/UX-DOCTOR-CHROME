import { LLM_PORT_NAME, type BackgroundRequest, type LlmPortRequest, type VerifyKeyResponse } from '@/shared/messages'
import { isProvider, type Provider } from '@/shared/models'
import { getPublicSettings } from '@/shared/settings'
import { createClient, describeApiError } from './claudeClient'
import { getGeminiModelInfo } from './geminiClient'
import { runLlmCall } from './llmCall'

// Araç çubuğu ikonuna tıklanınca popup yerine yan panel açılır.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error('[UX Doktor] Yan panel davranışı ayarlanamadı:', error))

// Ücretsiz uç noktalar: yalnızca modeli sorgular, sayfa verisi göndermez.
// Yanıt, doğrulanan sağlayıcıyı geri yansıtır (ayarlar sayfası eski service worker'ı bununla tanır).
async function verifyKey(provider: Provider): Promise<VerifyKeyResponse> {
  try {
    const settings = await getPublicSettings()
    if (provider === 'gemini') {
      const info = await getGeminiModelInfo(settings.geminiModel)
      return { ok: true, provider, message: `Anahtar geçerli. Model erişilebilir: ${info.displayName} (${info.name}).` }
    }
    const client = await createClient()
    const info = await client.models.retrieve(settings.claudeModel)
    return { ok: true, provider, message: `Anahtar geçerli. Model erişilebilir: ${info.display_name} (${info.id}).` }
  } catch (error) {
    return { ok: false, provider, message: describeApiError(error) }
  }
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  // Yalnızca kendi eklenti sayfalarımızdan (yan panel, ayarlar) gelen mesajları kabul et;
  // web sayfalarındaki betiklerin mesajları reddedilir.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false
  if (request.type === 'verify-key') {
    // Sağlayıcı belirtilmemişse sessizce Claude'a düşülmez; hangi anahtarın denendiği her zaman açıktır.
    if (!isProvider(request.provider)) {
      sendResponse({ ok: false, message: 'Doğrulama isteğinde geçerli bir sağlayıcı yok (claude | gemini).' })
      return false
    }
    verifyKey(request.provider).then(sendResponse)
    return true
  }
  return false
})

// LLM çağrıları port üzerinden gelir (yalnızca kendi eklenti sayfalarımızdan).
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== LLM_PORT_NAME) return
  if (port.sender?.id !== chrome.runtime.id || !port.sender.url?.startsWith(chrome.runtime.getURL(''))) {
    port.disconnect()
    return
  }
  port.onMessage.addListener((message: LlmPortRequest) => {
    if (message.type !== 'run') return // "ping": yalnızca service worker'ı uyanık tutar
    runLlmCall(message.requestId, message.request).then((response) => {
      try {
        port.postMessage(response)
      } catch {
        // Panel kapandıysa yanıt bırakılır.
      }
    })
  })
})
