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

// Kural başına Türkçe açıklama ve öneri şablonları: src/shared/axeTemplates.ts (tek kaynak).

/**
 * HTML parçasındaki form değerlerini gizler; kullanıcının girdiği değer rapora bile girmez:
 * value attribute'ları ve <textarea> içeriği (textarea'nın metni onun değeridir).
 */
export function stripValueAttributes(html: string): string {
  return hideEditableContent(
    html
      .replace(/\svalue\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' value="[gizlendi]"')
      .replace(/(<textarea\b[^>]*>)[\s\S]*?(<\/textarea>|$)/gi, '$1[gizlendi]$2'),
  )
}

/**
 * contenteditable bölgenin içeriği kullanıcının yazdığı metindir: ilk düzenlenebilir açılış etiketinden sonrası
 * tümüyle gizlenir (iç içe öğeler regex ile güvenle eşlenemediği için fazlası da gizlenir; gizlilik öncelikli).
 * contenteditable="false" düzenlenebilir sayılmaz.
 */
function hideEditableContent(html: string): string {
  const open = /<([a-z][\w-]*)\b[^>]*\scontenteditable(?:\s*=\s*(?:"(?!false")[^"]*"|'(?!false')[^']*'|(?!false)[^\s>"']+)|(?=[\s>/]))[^>]*>/i.exec(html)
  if (!open) return html
  const end = open.index + open[0].length
  const closing = `</${open[1]}>`
  return html.slice(0, end) + '[gizlendi]' + (html.toLowerCase().endsWith(closing.toLowerCase()) ? closing : '')
}
