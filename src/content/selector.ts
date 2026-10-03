// Benzersiz CSS seçici üretimi. Üretilen her seçicinin tekilliği querySelectorAll ile doğrulanır.
// Seçicilerde metin içeriği ya da aria-label kullanılmaz (kişisel veri sızmasın diye).
//
// Chrome sayfa çevirisi metin düğümlerini <font style="vertical-align: inherit;"> sarmalayıcılarıyla değiştirir;
// çeviri kapanınca bu öğeler kaybolur. Tekrarlanabilirlik için <font> öğeleri seçicide hiç kullanılmaz:
// hedef <font> ise en yakın <font> olmayan ataya çıkılır, yol kurulurken <font> atları atlanır.

const STABLE_ATTRIBUTES = ['data-testid', 'data-test', 'data-qa', 'name'] as const

/** Seçicide kullanılmayacak, anlamsız sarmalayıcı öğe (çeviri ya da eski HTML <font>). */
export function isWrapperElement(el: Element): boolean {
  return el.tagName === 'FONT'
}

/** <font> sarmalayıcılarını atlayarak en yakın anlamlı öğeyi döndürür. */
export function meaningfulElement(el: Element): Element {
  let current: Element = el
  while (isWrapperElement(current) && current.parentElement) current = current.parentElement
  return current
}

/** Seçici bir <font> adımı içeriyor mu (ör. "p > font > font", "font.x"). */
export function selectorMentionsFont(selector: string): boolean {
  return /(^|[\s>+~(,])font(?=$|[\s>+~.#:[),])/i.test(selector)
}

/** Seçici belgede tam olarak bir öğeyle ve bu öğeyle eşleşiyor mu. */
export function isUniqueSelector(selector: string, el?: Element): boolean {
  try {
    const matches = document.querySelectorAll(selector)
    return matches.length === 1 && (el === undefined || matches[0] === el)
  } catch {
    return false
  }
}

function nthPart(el: Element): string {
  let part = el.tagName.toLowerCase()
  const parent = el.parentElement
  if (parent) {
    const sameTag = Array.from(parent.children).filter((child) => child.tagName === el.tagName)
    if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(el) + 1})`
  }
  return part
}

/** Öğe ana belgede değilse (shadow DOM, iframe) null döner: bu öğeler sayfada vurgulanamaz. */
export function uniqueSelector(target: Element): string | null {
  const el = meaningfulElement(target)
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
  // Araya <font> girerse o adım atlanır ve alt-öğe birleştiricisi (" ") kullanılır.
  let selector = ''
  let current: Element | null = el
  while (current && current !== document.documentElement) {
    const part = nthPart(current)
    let parent: Element | null = current.parentElement
    let skippedWrapper = false
    while (parent && isWrapperElement(parent)) {
      parent = parent.parentElement
      skippedWrapper = true
    }
    if (current !== el && current.id) {
      const anchored = `#${CSS.escape(current.id)}${selector}`
      if (isUniqueSelector(anchored, el)) return anchored
    }
    selector = `${part}${selector}`
    if (isUniqueSelector(selector, el)) return selector
    selector = `${skippedWrapper ? ' ' : ' > '}${selector}`
    current = parent
  }
  const full = `html${selector}`
  return isUniqueSelector(full, el) ? full : null
}

/**
 * axe'in ürettiği hedefi doğrular; benzersiz değilse ya da <font> içeriyorsa öğeden kendi seçicimizi üretir.
 * Hedef öğe <font> ise seçici en yakın anlamlı ataya işaret eder.
 * Dönen `highlightable` false ise seçici yalnızca bilgi amaçlıdır.
 */
export function resolveSelector(axeTarget: unknown, el: Element | undefined): { selector: string; highlightable: boolean } {
  const target = el ? meaningfulElement(el) : undefined
  if (Array.isArray(axeTarget) && axeTarget.length === 1 && typeof axeTarget[0] === 'string') {
    const t = axeTarget[0]
    if (!selectorMentionsFont(t) && isUniqueSelector(t, target)) return { selector: t, highlightable: true }
  }
  if (target) {
    const own = uniqueSelector(target)
    if (own) return { selector: own, highlightable: true }
  }
  // Shadow DOM / iframe hedefleri: axe'in iç içe hedefini okunur biçimde yaz.
  const flat = Array.isArray(axeTarget) ? axeTarget.flat(3).map(String).join(' >>> ') : String(axeTarget)
  return { selector: flat, highlightable: false }
}
