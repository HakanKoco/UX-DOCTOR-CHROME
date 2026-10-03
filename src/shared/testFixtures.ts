// Birim testleri için örnek (uydurma) envanter. Kişisel veri örnekleri gerçek değildir.
import type { Inventory, InventoryElement } from './inventory'

function el(id: string, partial: Partial<InventoryElement>): InventoryElement {
  return {
    id,
    kind: 'interactive',
    tag: 'button',
    role: 'button',
    name: '',
    nameSource: 'none',
    rect: { x: 0, y: 0, w: 100, h: 40 },
    visible: true,
    aboveFold: true,
    fontSizePx: 16,
    states: {},
    style: { color: 'rgb(0, 0, 0)', background: 'rgb(255, 255, 255)', cursor: 'pointer', underline: false, fontWeight: 400, borderRadius: '4px' },
    selector: `#${id.toLowerCase()}`,
    ...partial,
  }
}

export function sampleInventory(): Inventory {
  return {
    page: {
      host: 'ornek-hastane.test',
      title: 'Randevu — 0532 123 45 67',
      lang: 'tr',
      viewport: { width: 1280, height: 800 },
      documentHeight: 2400,
      counts: {
        links: 3,
        buttons: 1,
        formFields: 1,
        forms: 1,
        images: 1,
        liveRegions: 0,
        progressIndicators: 0,
        loadingClassHints: 0,
        dialogs: 0,
        iframes: 0,
      },
      styleRules: {
        readableSheets: 1,
        unreadableSheets: 0,
        focusRules: 0,
        focusVisibleRules: 0,
        hoverRules: 2,
        outlineRemovedInFocusRules: 0,
      },
    },
    elements: [
      el('E1', { kind: 'heading', tag: 'h1', role: 'heading', name: 'Online Randevu', nameSource: 'text', headingLevel: 1 }),
      el('E2', { tag: 'button', name: 'Randevu al', nameSource: 'text' }),
      el('E3', { tag: 'input', role: 'textbox', inputType: 'text', name: 'TC kimlik: 12345678901', nameSource: 'placeholder' }),
      el('E4', { tag: 'a', role: 'link', name: 'iletisim@ornek.test', nameSource: 'text', href: 'mailto' }),
    ],
    meta: { limit: 200, candidateCount: 4, includedCount: 4, truncated: false, hiddenInteractiveSkipped: 0 },
  }
}
