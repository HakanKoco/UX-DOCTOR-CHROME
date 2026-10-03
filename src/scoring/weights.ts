// Skor formülünün TÜM ağırlıkları bu dosyadadır. Değiştirirsen FORMULA_VERSION'ı artır ve README'yi güncelle.
import type { DeterministicCategoryId, NormanPrincipleId, Severity } from '@/shared/report'

export const FORMULA_VERSION = 'skor-v1'

/**
 * Şiddet ağırlıkları: bir ihlalli öğenin (deterministik) ya da bir "hayır" cevabının (LLM) skoru ne kadar
 * düşürdüğü. Kritik bir sorun, düşük bir sorunun 4 katı ağırlıktadır.
 */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  Kritik: 4,
  Yüksek: 3,
  Orta: 2,
  Düşük: 1,
}

/**
 * Deterministik kategori ağırlıkları (toplam 1). Kontrast, alt metin ve form etiketleri
 * engelleyici etkisi en yüksek ve en sık görülen sorunlar olduğu için ağır basar.
 */
export const DETERMINISTIC_CATEGORY_WEIGHTS: Record<DeterministicCategoryId, number> = {
  contrast: 0.25,
  'text-alternatives': 0.2,
  'form-labels': 0.2,
  'target-size': 0.1,
  language: 0.1,
  'other-wcag': 0.15,
}

/** Norman ilkeleri eşit ağırlıklıdır (ödevde ilkeler arasında öncelik tanımlanmamış). */
export const PRINCIPLE_WEIGHTS: Record<NormanPrincipleId, number> = {
  visibility: 1 / 6,
  feedback: 1 / 6,
  constraints: 1 / 6,
  mapping: 1 / 6,
  consistency: 1 / 6,
  affordance: 1 / 6,
}

/**
 * Katman ağırlıkları: deterministik ölçüm tekrarlanabilir ve kesindir, LLM yorumu ise değişkendir;
 * bu yüzden toplamda deterministik katman daha ağır basar.
 */
export const LAYER_WEIGHTS = {
  deterministic: 0.6,
  llm: 0.4,
} as const
