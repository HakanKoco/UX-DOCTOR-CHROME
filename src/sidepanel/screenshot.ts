// Kırpılmış kanıt ekran görüntüsü. Görüntü yalnızca yerelde (panel durumu ve dışa aktarılan JSON) kalır;
// LLM'e GÖNDERİLMEZ (LLM gövdesi yalnızca envanterden kurulur).
// chrome.tabs.captureVisibleTab için activeTab ya da <all_urls> gerekir (resmi doküman).
import type { Finding } from '@/shared/report'
import { callContent } from './tabBridge'

const PADDING = 24
const MAX_WIDTH = 900

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Ekran görüntüsü okunamadı.'))
    img.src = dataUrl
  })
}

export async function captureFindingScreenshot(tabId: number, windowId: number, finding: Finding): Promise<string> {
  const res = await callContent(
    tabId,
    'highlight',
    [{ selector: finding.selector, label: finding.elementId ? `${finding.elementId} · ${finding.rule}` : finding.rule, severity: finding.severity }],
    true,
  )
  if (!res.firstRect) throw new Error('Öğe sayfada bulunamadı.')
  await new Promise((r) => setTimeout(r, 350)) // kaydırma ve vurgulamanın ekrana yansıması için
  // Kaydırma bittikten sonraki konum (yumuşak kaydırmalı sayfalarda ilk ölçüm eski olabilir).
  const settled = await callContent(
    tabId,
    'highlight',
    [{ selector: finding.selector, label: finding.elementId ? `${finding.elementId} · ${finding.rule}` : finding.rule, severity: finding.severity }],
    false,
  )
  await new Promise((r) => setTimeout(r, 100))
  let shot: string
  try {
    shot = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
  } catch (e) {
    throw new Error(
      `Ekran görüntüsü alınamadı (${e instanceof Error ? e.message : String(e)}). Simgeye bu sekmedeyken tıklayıp tekrar deneyin; vurgulama yine kullanılabilir.`,
    )
  }
  const img = await loadImage(shot)
  const dpr = settled.devicePixelRatio
  const rect = settled.firstRect ?? res.firstRect
  const sx = Math.max(0, (rect.x - PADDING) * dpr)
  const sy = Math.max(0, (rect.y - PADDING) * dpr)
  const sw = Math.min(img.width - sx, (rect.width + PADDING * 2) * dpr)
  const sh = Math.min(img.height - sy, (rect.height + PADDING * 2) * dpr)
  if (sw <= 0 || sh <= 0) throw new Error('Öğe görünür alanın dışında.')
  const scale = Math.min(1, MAX_WIDTH / sw)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Tuval oluşturulamadı.')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}
