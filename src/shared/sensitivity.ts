// Hassas sayfa tespiti. Sayfadan toplanan sinyaller (src/content/signals.ts) burada saf fonksiyonlarla
// değerlendirilir. Tespit edilirse LLM gönderimi kilitlenir; kullanıcı açık onay verirse açılır.

export interface SensitivitySignals {
  /** origin + pathname */
  url: string
  passwordFieldCount: number
  /** Sayfada bulunan autocomplete belirteçleri (küçük harf, tekilleştirilmiş). */
  autocompleteTokens: string[]
  /** Görünür bağlantı/düğme/menü/başlık metinleri ve aria-label'lar (yerelde kalır, LLM'e gitmez). */
  uiTexts: string[]
}

export interface SensitivityResult {
  sensitive: boolean
  reasons: string[]
}

/** Kart, tek kullanımlık kod ve şifre alanlarını işaret eden autocomplete belirteçleri. */
export function isSensitiveAutocompleteToken(token: string): boolean {
  const t = token.toLowerCase()
  return t.startsWith('cc-') || t === 'one-time-code' || t === 'current-password' || t === 'new-password'
}

/**
 * Oturum açılmış hesap ya da kişisel alan işaretleri. Tek kelimelik ifadeler yalnızca metnin tamamıyla
 * eşleşir ("Çıkış" ≠ "Acil Çıkış Planı"); çok kelimeliler metnin içinde geçebilir.
 */
export const ACCOUNT_PHRASES: readonly string[] = [
  'hesabım',
  'hesabıma git',
  'çıkış yap',
  'çıkış',
  'oturumu kapat',
  'oturumu sonlandır',
  'güvenli çıkış',
  'profilim',
  'randevularım',
  'siparişlerim',
  'kartlarım',
  'adreslerim',
  'tahlil sonuçlarım',
  'tahlillerim',
  'reçetelerim',
  'hasta bilgilerim',
  'kişisel bilgilerim',
  'hoş geldiniz',
  'my account',
  'my profile',
  'log out',
  'logout',
  'sign out',
]

/** Hesap/giriş/kişisel alan sayfalarını işaret eden URL kalıpları. */
export const URL_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\/(login|log-in|signin|sign-in|giris|giris-yap|uye-girisi|oturum-ac|auth|sso)(\/|$|[.?#])/i, label: 'giriş sayfası' },
  { pattern: /\/(hesabim|hesap|account|my-account|myaccount|profil|profile|uyelik|uye-bilgileri)(\/|$|[.?#])/i, label: 'hesap sayfası' },
  { pattern: /\/(randevularim|siparislerim|sonuclarim|tahlil-sonuclari|receteler|odeme|checkout|payment)(\/|$|[.?#])/i, label: 'kişisel işlem sayfası' },
  { pattern: /^https?:\/\/(giris\.turkiye\.gov\.tr|[^/]*enabiz\.gov\.tr|[^/]*mhrs\.gov\.tr)(\/|$)/i, label: 'kimlik doğrulamalı kamu/sağlık hizmeti' },
]

export function normalizeUiText(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchAccountTexts(texts: readonly string[]): string[] {
  const matched = new Set<string>()
  const phrases = ACCOUNT_PHRASES.map((p) => normalizeUiText(p))
  for (const raw of texts) {
    const text = normalizeUiText(raw)
    if (!text) continue
    for (const phrase of phrases) {
      const multiWord = phrase.includes(' ')
      if (text === phrase || (multiWord && ` ${text} `.includes(` ${phrase} `))) matched.add(phrase)
    }
  }
  // Sabit sıra (ACCOUNT_PHRASES sırası): rapor çıktısı her çalıştırmada aynı olsun.
  return phrases.filter((p) => matched.has(p))
}

export function matchUrlPatterns(url: string): string[] {
  return URL_PATTERNS.filter(({ pattern }) => pattern.test(url)).map(({ label }) => label)
}

export function detectSensitivePage(signals: SensitivitySignals): SensitivityResult {
  const reasons: string[] = []
  if (signals.passwordFieldCount > 0) reasons.push(`Şifre alanı var (${signals.passwordFieldCount} adet).`)
  const tokens = [...new Set(signals.autocompleteTokens.filter(isSensitiveAutocompleteToken))]
  if (tokens.length > 0) reasons.push(`Hassas autocomplete alanları var: ${tokens.join(', ')}.`)
  const phrases = matchAccountTexts(signals.uiTexts)
  if (phrases.length > 0) reasons.push(`Hesap/oturum metinleri bulundu: ${phrases.map((p) => `"${p}"`).join(', ')}.`)
  const urlLabels = matchUrlPatterns(signals.url)
  if (urlLabels.length > 0) reasons.push(`URL bir ${urlLabels.join(' / ')} kalıbına uyuyor.`)
  return { sensitive: reasons.length > 0, reasons }
}
