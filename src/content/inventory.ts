// Numaralı öğe envanteri (LLM katmanının tek girdisi).
// GİZLİLİK: input/textarea/select öğelerinin .value değeri OKUNMAZ; value attribute'u alınmaz;
// textarea içeriği ve contenteditable metni alınmaz. Metinler yan panelde ayrıca maskelenir.
import {
  INVENTORY_LIMIT,
  type Inventory,
  type InventoryElement,
  type InventoryKind,
  type NameSource,
  type PageSummary,
  type StyleRuleStats,
} from '@/shared/inventory'
import { uniqueSelector } from './selector'

const MAX_TEXT = 100

const LANDMARK_SELECTOR = [
  'header',
  'nav',
  'main',
  'footer',
  'aside',
  'form',
  'section[aria-label]',
  'section[aria-labelledby]',
  '[role="banner"]',
  '[role="navigation"]',
  '[role="main"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '[role="search"]',
  '[role="region"]',
  '[role="form"]',
].join(',')

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]'

const STATUS_SELECTOR = [
  '[aria-live]',
  '[role="status"]',
  '[role="alert"]',
  '[role="alertdialog"]',
  '[role="log"]',
  '[role="progressbar"]',
  '[role="timer"]',
  '[aria-busy="true"]',
  'progress',
  'dialog',
  '[role="dialog"]',
].join(',')

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden" i])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="slider"]',
  '[role="option"]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[onclick]',
].join(',')

const FORM_CONTROL_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'DATALIST'])

const ARIA_STATES = [
  'aria-expanded',
  'aria-pressed',
  'aria-checked',
  'aria-selected',
  'aria-current',
  'aria-disabled',
  'aria-invalid',
  'aria-required',
  'aria-haspopup',
  'aria-controls',
  'aria-live',
  'aria-busy',
  'aria-hidden',
  'aria-modal',
  'aria-sort',
]

function clip(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}…` : t
}

/**
 * Bir öğenin metnini, içindeki form denetimleri ve contenteditable bölgeler ÇIKARILMIŞ bir kopyadan alır.
 * Kopya belgeye eklenmez (sayfa değişmez); böylece textarea içeriği gibi kullanıcı verisi okunmaz.
 */
function safeText(el: Element): string {
  if (el instanceof HTMLElement && el.isContentEditable) return ''
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('input, textarea, select, option, datalist, [contenteditable], script, style, noscript, template').forEach((n) => n.remove())
  return clip(clone.textContent ?? '')
}

function textOfIds(ids: string): string {
  return clip(
    ids
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => n !== null)
      .map((n) => (FORM_CONTROL_TAGS.has(n.tagName) ? '' : safeText(n)))
      .join(' '),
  )
}

function labelText(el: Element): string {
  const parts: string[] = []
  if (el.id) {
    for (const label of document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)) parts.push(safeText(label))
  }
  const wrapping = el.closest('label')
  if (wrapping) parts.push(safeText(wrapping))
  return clip(parts.filter(Boolean).join(' '))
}

function implicitRole(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const type = (el.getAttribute('type') ?? 'text').toLowerCase()
  switch (tag) {
    case 'a':
      return el.hasAttribute('href') ? 'link' : 'generic'
    case 'button':
    case 'summary':
      return 'button'
    case 'input':
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button'
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'range') return 'slider'
      if (type === 'search') return 'searchbox'
      return 'textbox'
    case 'select':
      return el.hasAttribute('multiple') ? 'listbox' : 'combobox'
    case 'textarea':
      return 'textbox'
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading'
    case 'header':
      return el.closest('main, article, aside, nav, section') ? 'generic' : 'banner'
    case 'footer':
      return el.closest('main, article, aside, nav, section') ? 'generic' : 'contentinfo'
    case 'nav':
      return 'navigation'
    case 'main':
      return 'main'
    case 'aside':
      return 'complementary'
    case 'form':
      return 'form'
    case 'section':
      return 'region'
    case 'dialog':
      return 'dialog'
    case 'progress':
      return 'progressbar'
    case 'img':
      return 'img'
    default:
      return 'generic'
  }
}

function accessibleName(el: Element): { name: string; source: NameSource } {
  const labelledby = el.getAttribute('aria-labelledby')
  if (labelledby) {
    const t = textOfIds(labelledby)
    if (t) return { name: t, source: 'aria-labelledby' }
  }
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel?.trim()) return { name: clip(ariaLabel), source: 'aria-label' }

  const tag = el.tagName
  const type = (el.getAttribute('type') ?? '').toLowerCase()
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
    const label = labelText(el)
    if (label) return { name: label, source: 'label' }
    if (tag === 'INPUT' && type === 'image') {
      const alt = el.getAttribute('alt')
      if (alt?.trim()) return { name: clip(alt), source: 'alt' }
    }
    const title = el.getAttribute('title')
    if (title?.trim()) return { name: clip(title), source: 'title' }
    const placeholder = el.getAttribute('placeholder')
    if (placeholder?.trim()) return { name: clip(placeholder), source: 'placeholder' }
    if (tag === 'INPUT' && ['submit', 'button', 'reset'].includes(type) && el.hasAttribute('value')) {
      // Gizlilik kuralı: value attribute'u gönderilmez. Ad var ama içeriği paylaşılmıyor.
      return { name: '', source: 'value-attribute-hidden' }
    }
    return { name: '', source: 'none' }
  }

  const text = safeText(el)
  if (text) return { name: text, source: 'text' }
  const img = el.querySelector('img[alt]')
  const alt = img?.getAttribute('alt') ?? el.getAttribute('alt')
  if (alt?.trim()) return { name: clip(alt), source: 'alt' }
  const title = el.getAttribute('title')
  if (title?.trim()) return { name: clip(title), source: 'title' }
  return { name: '', source: 'none' }
}

function hrefKind(el: Element): InventoryElement['href'] {
  if (el.tagName !== 'A') return undefined
  const raw = el.getAttribute('href')
  if (raw === null) return undefined
  const href = raw.trim()
  if (href === '' ) return 'empty'
  if (href.startsWith('#')) return 'same-page-anchor'
  if (/^javascript:/i.test(href)) return 'javascript'
  if (/^mailto:/i.test(href)) return 'mailto'
  if (/^tel:/i.test(href)) return 'tel'
  try {
    return new URL(href, location.href).origin === location.origin ? 'internal' : 'external'
  } catch {
    return 'internal'
  }
}

function isVisible(el: Element, rect: DOMRect, style: CSSStyleDeclaration): boolean {
  if (rect.width < 1 || rect.height < 1) return false
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
  if (Number(style.opacity) === 0) return false
  return !el.closest('[hidden]')
}

function states(el: Element): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  if ((el as HTMLButtonElement).disabled === true) out.disabled = true
  if (el.hasAttribute('required')) out.required = true
  if (el.hasAttribute('readonly')) out.readonly = true
  for (const attr of ARIA_STATES) {
    const v = el.getAttribute(attr)
    if (v !== null) out[attr] = clip(v)
  }
  return out
}

function styleRuleStats(): StyleRuleStats {
  const stats: StyleRuleStats = {
    readableSheets: 0,
    unreadableSheets: 0,
    focusRules: 0,
    focusVisibleRules: 0,
    hoverRules: 0,
    outlineRemovedInFocusRules: 0,
  }
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const sel = rule.selectorText
        if (sel.includes(':focus-visible')) stats.focusVisibleRules++
        else if (sel.includes(':focus')) stats.focusRules++
        if (sel.includes(':hover')) stats.hoverRules++
        if (sel.includes(':focus')) {
          const outline = rule.style.outline || rule.style.outlineStyle || rule.style.outlineWidth
          if (/^(none|0(px)?)\b/.test(outline.trim())) stats.outlineRemovedInFocusRules++
        }
      } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
        visit((rule as CSSGroupingRule).cssRules)
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules)
      stats.readableSheets++
    } catch {
      stats.unreadableSheets++ // başka kökenden yüklenen stil dosyası (CORS) okunamaz
    }
  }
  return stats
}

function pageSummary(): PageSummary {
  return {
    host: location.host,
    title: clip(document.title),
    lang: document.documentElement.getAttribute('lang'),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentHeight: Math.round(document.documentElement.scrollHeight),
    counts: {
      links: document.querySelectorAll('a[href]').length,
      buttons: document.querySelectorAll('button, [role="button"], input[type="submit" i], input[type="button" i]').length,
      formFields: document.querySelectorAll('input:not([type="hidden" i]), select, textarea').length,
      forms: document.forms.length,
      images: document.images.length,
      liveRegions: document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]').length,
      progressIndicators: document.querySelectorAll('progress, [role="progressbar"], [aria-busy="true"]').length,
      loadingClassHints: document.querySelectorAll('[class*="spinner" i], [class*="loading" i], [class*="loader" i]').length,
      dialogs: document.querySelectorAll('dialog, [role="dialog"], [role="alertdialog"]').length,
      iframes: document.querySelectorAll('iframe').length,
    },
    styleRules: styleRuleStats(),
  }
}

interface Candidate {
  el: Element
  kind: InventoryKind
}

/** cursor: pointer olan ama etkileşimli olmayan öğeler (sağlarlık sinyali). Tarama ve sonuç sınırlı. */
function pointerNonInteractive(limit: number, scanCap = 4000): Element[] {
  const out: Element[] = []
  const all = document.body?.getElementsByTagName('*') ?? []
  const n = Math.min(all.length, scanCap)
  for (let i = 0; i < n && out.length < limit; i++) {
    const el = all[i]
    if (el.matches(INTERACTIVE_SELECTOR) || el.closest('a[href], button, [role="button"], [role="link"], label, summary')) continue
    const style = getComputedStyle(el)
    if (style.cursor !== 'pointer') continue
    // Yalnızca imleci kendisi tanımlayan en dıştaki öğe (miras alan çocuklar değil).
    const parent = el.parentElement
    if (parent && getComputedStyle(parent).cursor === 'pointer') continue
    const rect = el.getBoundingClientRect()
    if (isVisible(el, rect, style)) out.push(el)
  }
  return out
}

export function buildInventory(limit = INVENTORY_LIMIT): Inventory {
  const seen = new Set<Element>()
  const candidates: Candidate[] = []
  const push = (el: Element, kind: InventoryKind) => {
    if (seen.has(el)) return
    seen.add(el)
    candidates.push({ el, kind })
  }
  // Öncelik sırası: landmark → başlık → durum bölgeleri → etkileşimli → imleci işaretçi olan etkileşimsiz öğeler.
  document.querySelectorAll(LANDMARK_SELECTOR).forEach((el) => push(el, 'landmark'))
  document.querySelectorAll(HEADING_SELECTOR).forEach((el) => push(el, 'heading'))
  document.querySelectorAll(STATUS_SELECTOR).forEach((el) => push(el, 'status'))
  document.querySelectorAll(INTERACTIVE_SELECTOR).forEach((el) => push(el, 'interactive'))
  pointerNonInteractive(15).forEach((el) => push(el, 'pointer-noninteractive'))

  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const fold = window.innerHeight
  const elements: InventoryElement[] = []
  const idOf = new Map<Element, string>()
  let hiddenInteractiveSkipped = 0
  let eligible = 0

  for (const { el, kind } of candidates) {
    if (el.getRootNode() !== document) continue
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    const visible = isVisible(el, rect, style)
    // Görünmeyen etkileşimli öğeler ve başlıklar envantere girmez; durum bölgeleri boş/gizli olabilir, girer.
    if (!visible && (kind === 'interactive' || kind === 'heading' || kind === 'pointer-noninteractive')) {
      if (kind === 'interactive') hiddenInteractiveSkipped++
      continue
    }
    eligible++
    if (elements.length >= limit) continue
    const selector = uniqueSelector(el)
    if (!selector) continue
    const id = `E${elements.length + 1}`
    idOf.set(el, id)
    const { name, source } = accessibleName(el)
    const describedby = el.getAttribute('aria-describedby')
    const role = el.getAttribute('role')?.trim().split(/\s+/)[0] || implicitRole(el)
    const headingLevel =
      kind === 'heading'
        ? /^H[1-6]$/.test(el.tagName)
          ? Number(el.tagName[1])
          : Number(el.getAttribute('aria-level')) || undefined
        : undefined
    elements.push({
      id,
      kind,
      tag: el.tagName.toLowerCase(),
      role,
      name: kind === 'landmark' && source === 'text' ? '' : name,
      nameSource: kind === 'landmark' && source === 'text' ? 'none' : source,
      ...(describedby ? { description: textOfIds(describedby) } : {}),
      ...(el.tagName === 'INPUT' ? { inputType: (el.getAttribute('type') ?? 'text').toLowerCase() } : {}),
      ...(headingLevel ? { headingLevel } : {}),
      rect: {
        x: Math.round(rect.left + scrollX),
        y: Math.round(rect.top + scrollY),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      visible,
      aboveFold: visible && rect.top + scrollY < fold,
      fontSizePx: Math.round(parseFloat(style.fontSize) * 10) / 10,
      states: states(el),
      ...(hrefKind(el) ? { href: hrefKind(el) } : {}),
      style: {
        color: style.color,
        background: style.backgroundColor,
        cursor: style.cursor,
        underline: style.textDecorationLine.includes('underline'),
        fontWeight: Number(style.fontWeight) || 400,
        borderRadius: style.borderRadius,
      },
      selector,
    })
  }

  // Her öğeye içinde bulunduğu landmark'ın kimliğini ekle (yapısal eşleme sinyali).
  for (const item of elements) {
    if (item.kind === 'landmark') continue
    const el = document.querySelector(item.selector)
    const landmark = el?.parentElement?.closest(LANDMARK_SELECTOR)
    const landmarkId = landmark ? idOf.get(landmark) : undefined
    if (landmarkId) item.landmarkId = landmarkId
  }

  return {
    page: pageSummary(),
    elements,
    meta: {
      limit,
      candidateCount: eligible,
      includedCount: elements.length,
      truncated: eligible > elements.length,
      hiddenInteractiveSkipped,
    },
  }
}
