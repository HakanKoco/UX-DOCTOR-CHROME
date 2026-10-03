// Vurgulama katmanı. Sayfanın davranışını değiştirmez:
// - tüm katman pointer-events: none (tıklamalar sayfaya geçer),
// - stiller shadow DOM içinde (sayfa CSS'i etkilenmez ve etkilemez),
// - clearHighlights() ile tamamen kaldırılır; kalıcı bir değişiklik bırakmaz.

import type { Severity } from '@/shared/report'

const HOST_ID = 'ux-doktor-overlay-host'

const SEVERITY_COLORS: Record<Severity, string> = {
  Kritik: '#d93025',
  Yüksek: '#e8710a',
  Orta: '#f9ab00',
  Düşük: '#1a73e8',
}

export interface HighlightItem {
  selector: string
  label: string
  severity: Severity
}

export interface HighlightResult {
  found: number
  missing: string[]
  /** İlk öğenin görünüm alanı (viewport) koordinatları; kırpılmış ekran görüntüsü için. */
  firstRect: { x: number; y: number; width: number; height: number } | null
  devicePixelRatio: number
}

interface Tracked {
  el: Element
  box: HTMLDivElement
}

let tracked: Tracked[] = []
let rafId = 0

function reposition() {
  for (const { el, box } of tracked) {
    const r = el.getBoundingClientRect()
    box.style.transform = `translate(${r.left - 3}px, ${r.top - 3}px)`
    box.style.width = `${r.width + 6}px`
    box.style.height = `${r.height + 6}px`
  }
}

function scheduleReposition() {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(reposition)
}

export function clearHighlights(): void {
  window.removeEventListener('scroll', scheduleReposition, true)
  window.removeEventListener('resize', scheduleReposition)
  cancelAnimationFrame(rafId)
  tracked = []
  document.getElementById(HOST_ID)?.remove()
}

export function highlight(items: HighlightItem[], scrollToFirst: boolean): HighlightResult {
  clearHighlights()
  const host = document.createElement('div')
  host.id = HOST_ID
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;margin:0;padding:0;border:0;'
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = `
    .box{position:fixed;left:0;top:0;box-sizing:border-box;border:3px solid var(--c);border-radius:4px;
         box-shadow:0 0 0 2px #fff,0 0 12px var(--c);pointer-events:none}
    .tag{position:absolute;left:-3px;bottom:100%;margin-bottom:2px;background:var(--c);color:#fff;
         font:600 12px/1.4 system-ui,sans-serif;padding:1px 6px;border-radius:4px;white-space:nowrap;
         max-width:320px;overflow:hidden;text-overflow:ellipsis}`
  shadow.appendChild(style)

  const missing: string[] = []
  for (const item of items) {
    let el: Element | null = null
    try {
      el = document.querySelector(item.selector)
    } catch {
      el = null
    }
    if (!el) {
      missing.push(item.selector)
      continue
    }
    const box = document.createElement('div')
    box.className = 'box'
    box.style.setProperty('--c', SEVERITY_COLORS[item.severity])
    const tag = document.createElement('div')
    tag.className = 'tag'
    tag.textContent = item.label
    box.appendChild(tag)
    shadow.appendChild(box)
    tracked.push({ el, box })
  }

  document.documentElement.appendChild(host)
  if (scrollToFirst && tracked[0]) tracked[0].el.scrollIntoView({ block: 'center', inline: 'nearest' })
  reposition()
  window.addEventListener('scroll', scheduleReposition, { capture: true, passive: true })
  window.addEventListener('resize', scheduleReposition, { passive: true })

  const first = tracked[0]?.el.getBoundingClientRect()
  return {
    found: tracked.length,
    missing,
    firstRect: first ? { x: first.left, y: first.top, width: first.width, height: first.height } : null,
    devicePixelRatio: window.devicePixelRatio || 1,
  }
}
