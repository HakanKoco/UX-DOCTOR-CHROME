// axe-core sonuçlarını rapor bulgularına çeviren saf fonksiyonlar.
// Kural adları ve etiketleri axe-core 4.13.0 paketinden doğrulandı (axe.getRules()).
import type { DeterministicCategoryId, Severity } from './report'

/** CLAUDE.md: WCAG 2.2 AA etiketleri. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const

/**
 * Varsayılan olarak kapalı olup açıkça açılması gereken kurallar.
 * target-size, axe-core 4.13.0'da `enabled: false` gelir.
 */
export const AXE_FORCE_ENABLED_RULES = ['target-size'] as const

export const CATEGORY_RULES: Record<Exclude<DeterministicCategoryId, 'other-wcag'>, readonly string[]> = {
  contrast: ['color-contrast'],
  'text-alternatives': ['image-alt', 'input-image-alt', 'role-img-alt', 'svg-img-alt', 'area-alt', 'object-alt'],
  'form-labels': ['label', 'select-name', 'aria-input-field-name', 'aria-toggle-field-name'],
  'target-size': ['target-size'],
  language: ['html-has-lang', 'html-lang-valid', 'valid-lang', 'html-xml-lang-mismatch'],
}

export const CATEGORY_LABELS: Record<DeterministicCategoryId, string> = {
  contrast: 'Renk kontrastı',
  'text-alternatives': 'Metin alternatifi (alt metin)',
  'form-labels': 'Form alanı etiketleri',
  'target-size': 'Dokunma hedefi boyutu (24×24 px)',
  language: 'Sayfa dili',
  'other-wcag': 'Diğer WCAG 2.2 AA ihlalleri',
}

export const DETERMINISTIC_CATEGORY_IDS: readonly DeterministicCategoryId[] = [
  'contrast',
  'text-alternatives',
  'form-labels',
  'target-size',
  'language',
  'other-wcag',
]

export function categoryForRule(ruleId: string): DeterministicCategoryId {
  for (const [category, rules] of Object.entries(CATEGORY_RULES)) {
    if (rules.includes(ruleId)) return category as DeterministicCategoryId
  }
  return 'other-wcag'
}

/** axe etkisi → rapor şiddeti. Etki yoksa (ör. incomplete) "Orta". */
export function severityFromImpact(impact: string | null | undefined): Severity {
  switch (impact) {
    case 'critical':
      return 'Kritik'
    case 'serious':
      return 'Yüksek'
    case 'moderate':
      return 'Orta'
    case 'minor':
      return 'Düşük'
    default:
      return 'Orta'
  }
}

/**
 * axe etiketlerinden WCAG başarı ölçütü numarası üretir: "wcag143" → "WCAG 1.4.3", "wcag1410" → "WCAG 1.4.10".
 * Birden çok ölçüt varsa ilk ikisi yazılır. Hiç yoksa "WCAG" döner.
 */
export function wcagLabelFromTags(tags: readonly string[]): string {
  const criteria = tags
    .map((t) => /^wcag(\d)(\d)(\d{1,2})$/.exec(t))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => `${m[1]}.${m[2]}.${m[3]}`)
  if (criteria.length === 0) return 'WCAG'
  return `WCAG ${criteria.slice(0, 2).join(', ')}`
}

/** Kural başına Türkçe açıklama. Listede olmayan kurallarda axe'in kendi "help" metni kullanılır. */
const DESCRIPTIONS: Record<string, string> = {
  'color-contrast': 'Metin ile arka planı arasındaki renk kontrastı yetersiz.',
  'image-alt': 'Görselin metin alternatifi (alt) yok.',
  'input-image-alt': 'Görsel düğmenin (input type="image") metin alternatifi yok.',
  'role-img-alt': 'role="img" olan öğenin metin alternatifi yok.',
  'svg-img-alt': 'Görsel rolündeki SVG öğesinin metin alternatifi yok.',
  'area-alt': 'Görüntü haritası alanının (<area>) metin alternatifi yok.',
  'object-alt': '<object> öğesinin metin alternatifi yok.',
  label: 'Form alanının erişilebilir bir etiketi yok.',
  'select-name': 'Açılır listenin (select) erişilebilir bir adı yok.',
  'aria-input-field-name': 'ARIA giriş alanının erişilebilir bir adı yok.',
  'aria-toggle-field-name': 'ARIA aç/kapa alanının erişilebilir bir adı yok.',
  'target-size': 'Tıklanabilir hedef 24×24 CSS pikselinden küçük ve çevresinde yeterli boşluk yok.',
  'html-has-lang': 'Sayfanın dili (<html lang>) tanımlanmamış.',
  'html-lang-valid': '<html lang> değeri geçerli bir dil kodu değil.',
  'valid-lang': 'Bir öğedeki lang değeri geçerli bir dil kodu değil.',
  'html-xml-lang-mismatch': '<html> öğesinde lang ve xml:lang farklı dilleri gösteriyor.',
}

const FIXES: Record<string, string> = {
  'image-alt':
    'Görselin anlamını anlatan bir alt metni ekleyin: <img alt="…">. Görsel yalnızca süs amaçlıysa alt="" verin.',
  'input-image-alt': 'Görsel düğmeye işlevini anlatan alt ekleyin (ör. alt="Ara").',
  'role-img-alt': 'Öğeye aria-label ya da aria-labelledby ile görselin anlamını veren bir ad verin.',
  'svg-img-alt': 'SVG içine <title> ekleyin ya da aria-label / aria-labelledby ile ad verin.',
  'area-alt': '<area> öğesine bağlantının hedefini anlatan alt ekleyin.',
  'object-alt': '<object> öğesine aria-label ekleyin ya da içine metin alternatifi yazın.',
  label:
    'Alanı görünür bir <label for="alan-id"> ile ilişkilendirin. Görsel etiket mümkün değilse aria-label kullanın; placeholder tek başına etiket sayılmaz.',
  'select-name': 'Açılır listeyi görünür bir <label for="…"> ile ilişkilendirin ya da aria-label verin.',
  'aria-input-field-name': 'Özel giriş alanına aria-label ya da aria-labelledby ile görünür etiketine bağlı bir ad verin.',
  'aria-toggle-field-name': 'Aç/kapa öğesine aria-label ya da aria-labelledby ile ad verin.',
  'target-size':
    'Tıklanabilir alanı en az 24×24 CSS pikseli yapın (padding, min-width/min-height ile) ya da komşu hedeflerle arasında 24 px çaplı bir boşluk bırakın.',
  'html-has-lang': 'Kök öğeye sayfanın dilini ekleyin: <html lang="tr">.',
  'html-lang-valid': 'lang değerini geçerli bir BCP 47 koduyla değiştirin (ör. lang="tr").',
  'valid-lang': 'lang değerini geçerli bir BCP 47 koduyla değiştirin (ör. lang="en").',
  'html-xml-lang-mismatch': 'lang ve xml:lang değerlerini aynı dile ayarlayın ya da xml:lang değerini kaldırın.',
}

export interface ContrastData {
  fgColor?: string
  bgColor?: string
  contrastRatio?: number
  expectedContrastRatio?: string
  fontSize?: string
  fontWeight?: string
}

export function describeRule(ruleId: string, axeHelp: string): string {
  return DESCRIPTIONS[ruleId] ?? `axe: ${axeHelp}`
}

/** Somut düzeltme önerisi. Kontrastta ölçülen değerler öneriye yazılır. */
export function fixForRule(ruleId: string, axeHelp: string, helpUrl: string, data?: unknown): string {
  if (ruleId === 'color-contrast') {
    const d = (data ?? {}) as ContrastData
    if (d.fgColor && d.bgColor && d.contrastRatio !== undefined) {
      const expected = d.expectedContrastRatio ?? '4.5:1'
      return `Metin rengi ${d.fgColor} ile arka plan ${d.bgColor} arasındaki kontrast ${d.contrastRatio}:1; bu metin boyutu için en az ${expected} olmalı. Metin rengini koyulaştırın ya da arka planı açın (veya tersi) ve oranı yeniden ölçün.`
    }
    return 'Metin ve arka plan renklerini, normal metin için en az 4.5:1, büyük metin için en az 3:1 kontrast verecek şekilde değiştirin.'
  }
  return FIXES[ruleId] ?? `Kuralın gereğini karşılayın: ${axeHelp}. Ayrıntılı açıklama: ${helpUrl}`
}

/**
 * HTML parçasındaki form değerlerini gizler; kullanıcının girdiği değer rapora bile girmez:
 * value attribute'ları ve <textarea> içeriği (textarea'nın metni onun değeridir).
 */
export function stripValueAttributes(html: string): string {
  return html
    .replace(/\svalue\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' value="[gizlendi]"')
    .replace(/(<textarea\b[^>]*>)[\s\S]*?(<\/textarea>|$)/gi, '$1[gizlendi]$2')
}
