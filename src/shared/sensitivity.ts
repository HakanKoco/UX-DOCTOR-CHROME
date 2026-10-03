// Hassas sayfa tespiti — üç durumlu karar. Sayfadan toplanan sinyaller (src/content/signals.ts) burada saf
// fonksiyonlarla değerlendirilir:
//   "sensitive" (hassas)   → en az bir GÜÇLÜ sinyal. LLM gönderimi kilitli; açık onayla açılır.
//   "uncertain" (belirsiz) → yalnız ZAYIF sinyaller. Yine kilitli; açık onayla açılır (şüphede gönderilmez).
//   "safe" (hassas değil)  → hiçbir sinyal yok.
// Güçlü: görünür şifre/kart/OTP alanı, görünür hesap/oturum metni, giriş/hesap URL'si, bilinen özel uygulama
//        (sohbet, e-posta, mesajlaşma, kişisel belge, internet bankacılığı, kimlik doğrulamalı kamu/sağlık hizmeti).
// Zayıf: gizli (görünmeyen) hesap/oturum metni ya da şifre/kart alanı, <meta robots noindex>, büyük düzenlenebilir
//        yazma alanı (contenteditable / çok satırlı textbox; düz <textarea> sayılmaz), role="log" bölgesi.
// Görünmeyen menü metni tek başına hassasiyet kanıtı değildir (ör. herkese açık belge sayfasındaki gizli
// "Oturumu kapat" şablonu), ama yok da sayılmaz.

export type PrivacyLevel = 'safe' | 'uncertain' | 'sensitive'

export interface SensitivitySignals {
  /** origin + pathname */
  url: string
  /** Görünür şifre alanı sayısı. */
  passwordFieldCount: number
  /** Görünmeyen (gizli pencere, şablon) şifre alanı sayısı. */
  hiddenPasswordFieldCount: number
  /** Görünür alanlardaki autocomplete belirteçleri (küçük harf, tekilleştirilmiş). */
  autocompleteTokens: string[]
  /** Görünmeyen alanlardaki autocomplete belirteçleri. */
  hiddenAutocompleteTokens: string[]
  /** Görünür bağlantı/düğme/menü/başlık metinleri ve aria-label'lar (yerelde kalır, LLM'e gitmez). */
  uiTexts: string[]
  /** Görünmeyen öğelerdeki aynı tür metinler (kapalı menüler, şablonlar). */
  hiddenUiTexts: string[]
  /** <meta name="robots"> içinde noindex var mı. */
  robotsNoindex: boolean
  /** Görünür, büyük (en az 200×40 px) contenteditable ya da aria-multiline textbox sayısı. İçerik okunmaz. */
  composerCount: number
  /** role="log" bölge sayısı (sohbet/mesaj akışı). */
  logRegionCount: number
}

export interface SensitivityResult {
  level: PrivacyLevel
  /** Kararı "hassas" yapan sinyaller. */
  strongReasons: string[]
  /** Kararı "belirsiz" yapan sinyaller. */
  weakReasons: string[]
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
  'hesap menüsü',
  'kullanıcı menüsü',
  'my account',
  'account menu',
  'user menu',
  'profile menu',
  'my profile',
  'log out',
  'logout',
  'sign out',
]

/**
 * Bilinen özel uygulamalar: oturum açıkken kişisel içerik (sohbet, e-posta, mesaj, belge, banka) gösteren
 * alan adları ve yollar. Liste hiçbir zaman tam değildir; listede olmayanlar zayıf sinyallerle yakalanmaya çalışılır.
 */
export const PRIVATE_APP_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  {
    pattern: /^https?:\/\/(claude\.ai|chatgpt\.com|chat\.openai\.com|gemini\.google\.com|copilot\.microsoft\.com|chat\.deepseek\.com|chat\.mistral\.ai)(\/|$)/i,
    label: 'yapay zekâ sohbet uygulaması',
  },
  {
    pattern: /^https?:\/\/(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com|mail\.yahoo\.com|mail\.yandex\.(com|com\.tr|ru)|mail\.proton\.me)(\/|$)/i,
    label: 'e-posta uygulaması',
  },
  {
    pattern: /^https?:\/\/(web\.whatsapp\.com|web\.telegram\.org|www\.messenger\.com|app\.slack\.com|teams\.microsoft\.com|discord\.com\/channels)(\/|$)/i,
    label: 'mesajlaşma uygulaması',
  },
  {
    pattern: /^https?:\/\/(drive\.google\.com|docs\.google\.com\/(document|spreadsheets|presentation)\/d|onedrive\.live\.com)(\/|$)/i,
    label: 'kişisel dosya/belge',
  },
  { pattern: /^https?:\/\/([^/]*\.)?(internetsube|internetsubesi|isube|esube|internetbankaciligi)[.-]/i, label: 'internet bankacılığı' },
  { pattern: /\/(internet-?subesi|internet-?sube)(\/|$)/i, label: 'internet bankacılığı' },
]

/**
 * Sohbet/mesaj sayfalarını andıran yol kalıpları. Herkese açık sitelerde de geçebildiği için ZAYIF sinyaldir
 * (ör. "/c/…" e-ticaret kategori adreslerinde yaygın olduğundan bilerek listede yok).
 */
export const PRIVATE_PATH_PATTERNS: readonly RegExp[] = [
  /^https?:\/\/[^/]+\/(.+\/)?(chat|conversation|conversations)\/[^/]+/i,
  /^https?:\/\/[^/]+\/(.+\/)?(inbox|mesajlarim|messages)(\/|$)/i,
]

export function matchPrivateApp(url: string): string[] {
  return [...new Set(PRIVATE_APP_PATTERNS.filter(({ pattern }) => pattern.test(url)).map(({ label }) => label))]
}

export function matchPrivatePath(url: string): boolean {
  return PRIVATE_PATH_PATTERNS.some((pattern) => pattern.test(url))
}

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
  const strong: string[] = []
  const weak: string[] = []
  const quoted = (list: string[]) => list.map((p) => `"${p}"`).join(', ')

  if (signals.passwordFieldCount > 0) strong.push(`Görünür şifre alanı var (${signals.passwordFieldCount} adet).`)
  const tokens = [...new Set(signals.autocompleteTokens.filter(isSensitiveAutocompleteToken))]
  if (tokens.length > 0) strong.push(`Hassas autocomplete alanları var: ${tokens.join(', ')}.`)
  const phrases = matchAccountTexts(signals.uiTexts)
  if (phrases.length > 0) strong.push(`Görünür hesap/oturum metinleri: ${quoted(phrases)}.`)
  const urlLabels = matchUrlPatterns(signals.url)
  if (urlLabels.length > 0) strong.push(`URL bir ${urlLabels.join(' / ')} kalıbına uyuyor.`)
  const apps = matchPrivateApp(signals.url)
  if (apps.length > 0) strong.push(`Bilinen özel uygulama: ${apps.join(' / ')}.`)

  if (signals.hiddenPasswordFieldCount > 0) {
    weak.push(`Görünmeyen şifre alanı var (${signals.hiddenPasswordFieldCount} adet; ör. kapalı giriş penceresi).`)
  }
  const hiddenTokens = [...new Set(signals.hiddenAutocompleteTokens.filter(isSensitiveAutocompleteToken))].filter(
    (t) => !tokens.includes(t),
  )
  if (hiddenTokens.length > 0) weak.push(`Görünmeyen alanlarda hassas autocomplete: ${hiddenTokens.join(', ')}.`)
  const hiddenPhrases = matchAccountTexts(signals.hiddenUiTexts).filter((p) => !phrases.includes(p))
  if (hiddenPhrases.length > 0) {
    weak.push(`Yalnızca görünmeyen öğelerde hesap/oturum metni: ${quoted(hiddenPhrases)} (kapalı menü ya da şablon olabilir).`)
  }
  if (apps.length === 0 && matchPrivatePath(signals.url)) {
    weak.push('URL yolu bir sohbet/mesaj sayfasını andırıyor (ör. /chat/…, /inbox).')
  }
  if (signals.robotsNoindex) {
    weak.push('Sayfa arama motorlarına kapalı (<meta name="robots" content="noindex">); özel bir uygulama sayfası olabilir.')
  }
  if (signals.composerCount > 0) {
    weak.push(
      `Büyük bir yazma alanı var (${signals.composerCount} adet contenteditable/çok satırlı metin kutusu); sohbet ya da e-posta uygulaması olabilir.`,
    )
  }
  if (signals.logRegionCount > 0) weak.push(`Mesaj akışı bölgesi var (role="log", ${signals.logRegionCount} adet).`)

  const level: PrivacyLevel = strong.length > 0 ? 'sensitive' : weak.length > 0 ? 'uncertain' : 'safe'
  return { level, strongReasons: strong, weakReasons: weak }
}

/** LLM gönderimi kilitli mi: hem "hassas" hem "belirsiz" kilitler (şüphede gönderilmez). */
export function isLocked(level: PrivacyLevel): boolean {
  return level !== 'safe'
}
