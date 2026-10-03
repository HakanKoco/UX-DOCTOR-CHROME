import type { BackgroundRequest, VerifyKeyResponse } from '@/shared/messages'
import { getPublicSettings } from '@/shared/settings'
import { createClient, describeApiError } from './claudeClient'

// Araç çubuğu ikonuna tıklanınca popup yerine yan panel açılır.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error('[UX Doktor] Yan panel davranışı ayarlanamadı:', error))

async function verifyKey(): Promise<VerifyKeyResponse> {
  try {
    const { model } = await getPublicSettings()
    const client = await createClient()
    // Ücretsiz uç nokta: modeli sorgular, sayfa verisi göndermez.
    const info = await client.models.retrieve(model)
    return { ok: true, message: `Anahtar geçerli. Model erişilebilir: ${info.display_name} (${info.id}).` }
  } catch (error) {
    return { ok: false, message: describeApiError(error) }
  }
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  // Yalnızca kendi eklenti sayfalarımızdan (yan panel, ayarlar) gelen mesajları kabul et;
  // web sayfalarındaki betiklerin mesajları reddedilir.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false
  if (request.type === 'verify-key') {
    verifyKey().then(sendResponse)
    return true
  }
  return false
})
