// LLM'e giden DOM özeti: numaralı öğe envanteri (E1, E2, …). Envanter sayfada üretilir
// (src/content/inventory.ts), yan panelde maskelenir (toLlmInventory) ve onay ekranında gösterilir.
import { maskDeep } from './masking'

export const INVENTORY_LIMIT = 200

export type NameSource =
  | 'aria-labelledby'
  | 'aria-label'
  | 'label'
  | 'alt'
  | 'title'
  | 'placeholder'
  | 'text'
  | 'value-attribute-hidden'
  | 'none'

export type InventoryKind = 'landmark' | 'heading' | 'status' | 'interactive' | 'pointer-noninteractive'

export interface InventoryElement {
  id: string
  kind: InventoryKind
  tag: string
  role: string
  /** Erişilebilir ad ya da görünür metin (en çok 100 karakter, maskelenmiş). */
  name: string
  /** Etiket türü: adın nereden geldiği. */
  nameSource: NameSource
  /** aria-describedby ile bağlı açıklama (maskelenmiş). */
  description?: string
  inputType?: string
  headingLevel?: number
  /** Sayfa koordinatları (px, yuvarlanmış). */
  rect: { x: number; y: number; w: number; h: number }
  visible: boolean
  /** Sayfa ilk açıldığında görünür alanda mı (ekranın üst kısmı). */
  aboveFold: boolean
  fontSizePx: number
  /** disabled, required, readonly ve aria-* durumları. */
  states: Record<string, string | boolean>
  /** Bağlantı hedef türü; tam URL gönderilmez. */
  href?: 'same-page-anchor' | 'internal' | 'external' | 'javascript' | 'mailto' | 'tel' | 'empty'
  /** Sağlarlık/tutarlılık sinyalleri: hesaplanmış stiller. */
  style: { color: string; background: string; cursor: string; underline: boolean; fontWeight: number; borderRadius: string }
  /** İçinde bulunduğu landmark öğesinin kimliği. */
  landmarkId?: string
  selector: string
}

export interface StyleRuleStats {
  readableSheets: number
  unreadableSheets: number
  focusRules: number
  focusVisibleRules: number
  hoverRules: number
  /** :focus kurallarında outline: none/0 sayısı (odak göstergesini kaldırma). */
  outlineRemovedInFocusRules: number
}

export interface PageSummary {
  host: string
  title: string
  lang: string | null
  viewport: { width: number; height: number }
  documentHeight: number
  counts: {
    links: number
    buttons: number
    formFields: number
    forms: number
    images: number
    liveRegions: number
    progressIndicators: number
    /** Sınıf adında spinner/loading/loader geçen öğe sayısı (yükleme göstergesi ipucu). */
    loadingClassHints: number
    dialogs: number
    iframes: number
  }
  styleRules: StyleRuleStats
}

export interface Inventory {
  page: PageSummary
  elements: InventoryElement[]
  meta: {
    limit: number
    candidateCount: number
    includedCount: number
    truncated: boolean
    /** Görünmediği için dışarıda bırakılan etkileşimli öğe sayısı. */
    hiddenInteractiveSkipped: number
  }
}

/** Sayfa düzeyinde (belirli bir öğeye bağlanamayan) bulgular için geçerli özel kimlik. */
export const PAGE_EVIDENCE_ID = 'SAYFA'

/**
 * LLM'e gidecek envanter: tüm metinler maskelenir. Seçiciler de maskelenir (yerelde gerçek seçiciler
 * envanter haritasında tutulur; LLM yalnızca kimliklere atıf yapar).
 */
export function toLlmInventory(inventory: Inventory): Inventory {
  return maskDeep(inventory)
}

export function inventoryIdSet(inventory: Inventory): Set<string> {
  return new Set(inventory.elements.map((e) => e.id))
}
