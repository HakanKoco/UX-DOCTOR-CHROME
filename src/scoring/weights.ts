// Skor formülünün TÜM ağırlıkları bu dosyadadır. Değiştirirsen FORMULA_VERSION'ı artır ve README'yi güncelle.
import type { DeterministicCategoryId, NormanPrincipleId, Severity } from '@/shared/report'

export const FORMULA_VERSION = 'skor-v3'

/**
 * Kategori doygunluk sabiti k: S_c = 100 · e^(−D_c / k). D_c, kategorideki şiddet ağırlıklı ve log-sönümlü ceza
 * toplamıdır. Tek bir Kritik ihlal (D_c = 4) kategoriyi 85.2'ye, aynı Yüksek kuralda 5 öğe (D_c ≈ 10) 67.1'e indirir.
 */
export const SATURATION_K = 25

/**
 * Kural terimi sabiti: T = 100 · e^(−R / RULE_K). R, ihlal edilen benzersiz kuralların şiddet ağırlıkları toplamıdır
 * (öğe sayısı girmez). Tek Kritik kural (R = 4) → 81.9; beş farklı Kritik kural (R = 20) → 36.8.
 */
export const RULE_K = 20

/**
 * Deterministik skorun iki yarısı (skor-v3, README "Skor formülü"): kategori skorlarının ağırlıklı geometrik
 * ortalaması ve benzersiz kural terimi. 0,6/0,4 de denendi; altı gerçek sitede sıralama değişmedi, skorlar yalnızca
 * 1-3 puan yükseldi. Bu yüzden en sade oran olan ½/½ seçildi.
 */
export const DETERMINISTIC_BLEND = {
  categories: 0.5,
  rules: 0.5,
} as const

/**
 * LLM kapsam eşiği (A2): bir ilkede evet ya da hayır ile yanıtlanan soru sayısı bundan azsa ilke "yetersiz kapsam"
 * olur ve LLM ortalamasına girmez. Böylece tek bir "evet" ilkeye 100 verip toplamı belirleyemez.
 */
export const LLM_MIN_ANSWERED_PER_PRINCIPLE = 3

/**
 * Şiddet ağırlıkları: ihlal edilen bir kuralın (deterministik) ya da bir "hayır" cevabının (LLM) skoru ne kadar
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
 * Kategori skorlarının ağırlıklı geometrik ortalamasında üs olarak kullanılır (üslerin toplamı 1).
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
