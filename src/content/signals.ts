// Hassas sayfa tespiti için sinyal toplama. Değerlendirme src/shared/sensitivity.ts içinde (birim testli).
// Form alanlarının ve yazma alanlarının DEĞERİ/İÇERİĞİ okunmaz; yalnızca tür, autocomplete belirteci, görünürlük
// ve boyut kullanılır. Toplanan arayüz metinleri yalnızca yerel tespitte kullanılır, LLM'e gönderilmez.
import type { SensitivitySignals } from '@/shared/sensitivity'

const UI_TEXT_SELECTOR = 'a, button, [role="button"], [role="link"], [role="menuitem"], h1, h2, h3, nav li, header li'
const COMPOSER_SELECTOR = '[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"][aria-multiline="true"]'
const MAX_TEXTS = 600
const MAX_TEXT_LENGTH = 80

/** Öğe ekranda görünür mü (display/visibility/opacity ve sıfır boyut). Chrome 105+ checkVisibility kullanılır. */
export function isRendered(el: Element): boolean {
  const visible =
    typeof el.checkVisibility === 'function'
      ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      : el.getClientRects().length > 0
  if (!visible) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function pushText(list: string[], text: string | null | undefined): void {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (t) list.push(t.slice(0, MAX_TEXT_LENGTH))
}

export function collectSensitivitySignals(): SensitivitySignals {
  const autocompleteTokens = new Set<string>()
  const hiddenAutocompleteTokens = new Set<string>()
  for (const el of document.querySelectorAll('[autocomplete]')) {
    const target = isRendered(el) ? autocompleteTokens : hiddenAutocompleteTokens
    const value = el.getAttribute('autocomplete') ?? ''
    for (const token of value.toLowerCase().split(/\s+/)) if (token) target.add(token)
  }

  const uiTexts: string[] = []
  const hiddenUiTexts: string[] = []
  for (const el of document.querySelectorAll(UI_TEXT_SELECTOR)) {
    if (uiTexts.length + hiddenUiTexts.length >= MAX_TEXTS) break
    // Görünmeyen öğede innerText, textContent'e düşer; bu yüzden ayrım açıkça yapılır.
    if (isRendered(el)) {
      pushText(uiTexts, el.getAttribute('aria-label'))
      pushText(uiTexts, (el as HTMLElement).innerText)
    } else {
      pushText(hiddenUiTexts, el.getAttribute('aria-label'))
      pushText(hiddenUiTexts, el.textContent)
    }
  }

  let passwordFieldCount = 0
  let hiddenPasswordFieldCount = 0
  for (const el of document.querySelectorAll('input[type="password" i]')) {
    if (isRendered(el)) passwordFieldCount++
    else hiddenPasswordFieldCount++
  }

  let composerCount = 0
  for (const el of document.querySelectorAll(COMPOSER_SELECTOR)) {
    if (!isRendered(el)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width >= 200 && rect.height >= 40) composerCount++
  }

  const robots = Array.from(document.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]'))
    .map((m) => (m.getAttribute('content') ?? '').toLowerCase())
    .join(',')

  return {
    url: `${location.origin}${location.pathname}`,
    passwordFieldCount,
    hiddenPasswordFieldCount,
    autocompleteTokens: [...autocompleteTokens],
    hiddenAutocompleteTokens: [...hiddenAutocompleteTokens],
    uiTexts,
    hiddenUiTexts,
    robotsNoindex: /(^|,|\s)(noindex|none)(,|\s|$)/.test(robots),
    composerCount,
    logRegionCount: document.querySelectorAll('[role="log"]').length,
  }
}
