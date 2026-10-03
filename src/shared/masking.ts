// Metin maskeleme: LLM'e ve rapora giden metinlerde kişisel veriyi yer tutucuyla değiştirir.
// Sıra önemlidir (IBAN → e-posta → telefon → kart → TC): bir kalıbın parçası başka kalıba eşleşmesin.
// Telefon karttan önce gelir, çünkü "0090 312 444 55 66" 14 hanedir ve aksi halde kart sanılır.
// Telefon kalıbı 0 ile başlamayan bitişik 11 haneyi (TC) yakalamaz; kart numaralarını da yakalamaz.
// Gizlilik önceliklidir: şüpheli durumda fazla maskelemek, eksik maskelemekten iyidir.

export type MaskKind = 'IBAN' | 'E-POSTA' | 'KART' | 'TC' | 'TELEFON'

interface MaskRule {
  kind: MaskKind
  pattern: RegExp
}

const RULES: readonly MaskRule[] = [
  // TR IBAN: "TR" + 2 kontrol + 22 hane (boşluklu ya da bitişik). Diğer ülke IBAN'ları: 2 büyük harf + 2 hane + 11-30 alfasayısal.
  { kind: 'IBAN', pattern: /\bTR\d{2}(?:[ ]?\d){22}\b/gi },
  { kind: 'IBAN', pattern: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g },
  { kind: 'E-POSTA', pattern: /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi },
  // Uluslararası biçim: +ülke kodu ve 6-12 hane.
  { kind: 'TELEFON', pattern: /\+\d{1,3}(?:[\s.-]?\(?\d\)?){6,12}(?!\d)/g },
  // Türkiye: (0|90|+90)? 3 haneli alan/hat kodu (2xx-5xx) + 3 + 2 + 2 hane; ayraçlar isteğe bağlı.
  {
    kind: 'TELEFON',
    pattern: /(?<!\d)(?:(?:\+?90|0090)[\s.-]?|0[\s.-]?)?\(?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/g,
  },
  // Kart: 13-19 hane, aralarında boşluk/tire olabilir.
  { kind: 'KART', pattern: /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g },
  // TC kimlik no: 0 ile başlamayan, tam 11 hane.
  { kind: 'TC', pattern: /(?<!\d)[1-9]\d{10}(?!\d)/g },
]

export interface MaskResult {
  text: string
  counts: Partial<Record<MaskKind, number>>
}

export function maskTextWithCounts(input: string): MaskResult {
  let text = input
  const counts: Partial<Record<MaskKind, number>> = {}
  for (const { kind, pattern } of RULES) {
    text = text.replace(pattern, () => {
      counts[kind] = (counts[kind] ?? 0) + 1
      return `[${kind}]`
    })
  }
  return { text, counts }
}

export function maskText(input: string): string {
  return maskTextWithCounts(input).text
}

/** Nesne içindeki tüm string değerleri maskeler (anahtarlar değişmez). */
export function maskDeep<T>(value: T): T {
  if (typeof value === 'string') return maskText(value) as T
  if (Array.isArray(value)) return value.map((v) => maskDeep(v)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskDeep(v)])) as T
  }
  return value
}
