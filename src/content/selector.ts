// Benzersiz CSS seçici üretimi. Üretilen her seçicinin tekilliği querySelectorAll ile doğrulanır.
// Seçicilerde metin içeriği ya da aria-label kullanılmaz (kişisel veri sızmasın diye).

const STABLE_ATTRIBUTES = ['data-testid', 'data-test', 'data-qa', 'name'] as const

/** Seçici belgede tam olarak bir öğeyle ve bu öğeyle eşleşiyor mu. */
export function isUniqueSelector(selector: string, el?: Element): boolean {
  try {
    const matches = document.querySelectorAll(selector)
    return matches.length === 1 && (el === undefined || matches[0] === el)
  } catch {
    return false
  }
}

/** Öğe ana belgede değilse (shadow DOM, iframe) null döner: bu öğeler sayfada vurgulanamaz. */
export function uniqueSelector(el: Element): string | null {
  if (!el.isConnected || el.getRootNode() !== document) return null

  if (el.id) {
    const byId = `#${CSS.escape(el.id)}`
    if (isUniqueSelector(byId, el)) return byId
  }

  const tag = el.tagName.toLowerCase()
  for (const attr of STABLE_ATTRIBUTES) {
    const value = el.getAttribute(attr)
    if (value && value.length <= 80) {
      const byAttr = `${tag}[${attr}="${CSS.escape(value)}"]`
      if (isUniqueSelector(byAttr, el)) return byAttr
    }
  }

  // Alttan yukarı doğru yol oluştur; her adımda en kısa benzersiz soneki dene.
  const parts: string[] = []
  let current: Element | null = el
  while (current && current !== document.documentElement) {
    const parent: Element | null = current.parentElement
    if (current !== el && current.id) {
      const anchored = [`#${CSS.escape(current.id)}`, ...parts].join(' > ')
      if (isUniqueSelector(anchored, el)) return anchored
    }
    let part = current.tagName.toLowerCase()
    if (parent) {
      const currentTag = current.tagName
      const sameTag = Array.from(parent.children).filter((child) => child.tagName === currentTag)
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`
    }
    parts.unshift(part)
    const candidate = parts.join(' > ')
    if (isUniqueSelector(candidate, el)) return candidate
    current = parent
  }
  const full = ['html', ...parts].join(' > ')
  return isUniqueSelector(full, el) ? full : null
}

/**
 * axe'in ürettiği hedefi doğrular; benzersiz değilse öğeden kendi seçicimizi üretir.
 * Dönen `highlightable` false ise seçici yalnızca bilgi amaçlıdır.
 */
export function resolveSelector(axeTarget: unknown, el: Element | undefined): { selector: string; highlightable: boolean } {
  if (Array.isArray(axeTarget) && axeTarget.length === 1 && typeof axeTarget[0] === 'string') {
    const t = axeTarget[0]
    if (isUniqueSelector(t, el)) return { selector: t, highlightable: true }
  }
  if (el) {
    const own = uniqueSelector(el)
    if (own) return { selector: own, highlightable: true }
  }
  // Shadow DOM / iframe hedefleri: axe'in iç içe hedefini okunur biçimde yaz.
  const flat = Array.isArray(axeTarget) ? axeTarget.flat(3).map(String).join(' >>> ') : String(axeTarget)
  return { selector: flat, highlightable: false }
}
