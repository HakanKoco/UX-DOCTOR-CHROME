// Hassas sayfa tespiti için sinyal toplama. Değerlendirme src/shared/sensitivity.ts içinde (birim testli).
// Form alanlarının değeri okunmaz; yalnızca alan türü ve autocomplete belirteçleri sayılır.
// Toplanan arayüz metinleri yalnızca yerel tespitte kullanılır, LLM'e gönderilmez.
import type { SensitivitySignals } from '@/shared/sensitivity'

const UI_TEXT_SELECTOR = 'a, button, [role="button"], [role="link"], [role="menuitem"], h1, h2, h3, nav li, header li'
const MAX_TEXTS = 600
const MAX_TEXT_LENGTH = 80

export function collectSensitivitySignals(): SensitivitySignals {
  const autocompleteTokens = new Set<string>()
  for (const el of document.querySelectorAll('[autocomplete]')) {
    const value = el.getAttribute('autocomplete') ?? ''
    for (const token of value.toLowerCase().split(/\s+/)) if (token) autocompleteTokens.add(token)
  }

  const uiTexts: string[] = []
  for (const el of document.querySelectorAll(UI_TEXT_SELECTOR)) {
    if (uiTexts.length >= MAX_TEXTS) break
    const label = el.getAttribute('aria-label')
    if (label) uiTexts.push(label.slice(0, MAX_TEXT_LENGTH))
    const text = (el as HTMLElement).innerText ?? el.textContent ?? ''
    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (trimmed) uiTexts.push(trimmed.slice(0, MAX_TEXT_LENGTH))
  }

  return {
    url: `${location.origin}${location.pathname}`,
    passwordFieldCount: document.querySelectorAll('input[type="password" i]').length,
    autocompleteTokens: [...autocompleteTokens],
    uiTexts,
  }
}
