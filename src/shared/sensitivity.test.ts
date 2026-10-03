import { describe, expect, it } from 'vitest'
import {
  detectSensitivePage,
  isLocked,
  isSensitiveAutocompleteToken,
  matchAccountTexts,
  matchPrivateApp,
  matchPrivatePath,
  matchUrlPatterns,
  type SensitivitySignals,
} from './sensitivity'

const base: SensitivitySignals = {
  url: 'https://www.ornek-hastane.com.tr/bolumler/kardiyoloji',
  passwordFieldCount: 0,
  hiddenPasswordFieldCount: 0,
  autocompleteTokens: [],
  hiddenAutocompleteTokens: [],
  uiTexts: ['Ana Sayfa', 'Bölümlerimiz', 'Online Randevu', 'İletişim'],
  hiddenUiTexts: [],
  robotsNoindex: false,
  composerCount: 0,
  logRegionCount: 0,
}

describe('detectSensitivePage — üç durumlu karar', () => {
  it('herkese açık sayfa: hassas değil', () => {
    expect(detectSensitivePage(base)).toEqual({ level: 'safe', strongReasons: [], weakReasons: [] })
    expect(isLocked('safe')).toBe(false)
  })

  it('görünür şifre alanı: hassas', () => {
    const r = detectSensitivePage({ ...base, passwordFieldCount: 1 })
    expect(r.level).toBe('sensitive')
    expect(r.strongReasons[0]).toContain('şifre alanı')
    expect(isLocked(r.level)).toBe(true)
  })

  it('yalnızca gizli şifre alanı (kapalı giriş penceresi): belirsiz', () => {
    const r = detectSensitivePage({ ...base, hiddenPasswordFieldCount: 1 })
    expect(r.level).toBe('uncertain')
    expect(isLocked(r.level)).toBe(true)
  })

  it('görünür kart ve tek kullanımlık kod alanları: hassas; e-posta sayılmaz', () => {
    const r = detectSensitivePage({ ...base, autocompleteTokens: ['shipping', 'cc-number', 'one-time-code', 'email'] })
    expect(r.level).toBe('sensitive')
    expect(r.strongReasons[0]).toContain('cc-number')
    expect(r.strongReasons[0]).toContain('one-time-code')
    expect(r.strongReasons[0]).not.toContain('email')
  })

  it('görünür oturum metinleri: hassas', () => {
    const r = detectSensitivePage({ ...base, uiTexts: [...base.uiTexts, 'Hesabım', 'Çıkış Yap'] })
    expect(r.level).toBe('sensitive')
    expect(r.strongReasons[0]).toContain('"hesabım"')
    expect(r.strongReasons[0]).toContain('"çıkış yap"')
  })

  it('yalnızca gizli oturum metni: belirsiz (tek başına kanıt değil, yok da sayılmaz)', () => {
    const r = detectSensitivePage({ ...base, hiddenUiTexts: ['Oturumu kapat'] })
    expect(r.level).toBe('uncertain')
    expect(r.weakReasons[0]).toContain('"oturumu kapat"')
  })

  it('giriş URL kalıbı: hassas', () => {
    const r = detectSensitivePage({ ...base, url: 'https://www.ornek.com/uye-girisi' })
    expect(r.level).toBe('sensitive')
    expect(r.strongReasons[0]).toContain('giriş sayfası')
  })

  it.each([
    ['noindex', { robotsNoindex: true }],
    ['yazma alanı', { composerCount: 1 }],
    ['mesaj akışı', { logRegionCount: 1 }],
    ['sohbet yolu', { url: 'https://ornek.com/destek/chat/123' }],
  ] as const)('uygulama kabuğu işareti (%s) tek başına: belirsiz', (_name, over) => {
    expect(detectSensitivePage({ ...base, ...over }).level).toBe('uncertain')
  })

  it('güçlü ve zayıf sinyaller ayrı listelenir; güçlü varsa karar hassas', () => {
    const r = detectSensitivePage({
      ...base,
      url: 'https://ornek.com/hesabim/randevularim',
      passwordFieldCount: 2,
      autocompleteTokens: ['new-password'],
      uiTexts: ['Randevularım'],
      robotsNoindex: true,
    })
    expect(r.level).toBe('sensitive')
    expect(r.strongReasons).toHaveLength(4)
    expect(r.weakReasons).toHaveLength(1)
  })
})

// Gerçek gözlemlerden kurulan ANONİM sinyal örnekleri. Hiçbir gerçek kişisel içerik yoktur: yalnızca genel arayüz
// metinleri ve yapısal sayaçlar. (Yapı varsayımsaldır; gerçek sayfaların DOM'u kopyalanmadı.)
describe('gerçek gözlem örnekleri', () => {
  it('(a) learn.microsoft.com benzeri herkese açık belge sayfası, gizli menüde "Oturumu kapat": hassas DEĞİL ya da belirsiz', () => {
    const r = detectSensitivePage({
      ...base,
      url: 'https://learn.microsoft.com/tr-tr/dotnet/csharp/',
      uiTexts: ['Learn', 'Belgeler', 'Eğitim', 'Oturum aç', 'İçindekiler'],
      hiddenUiTexts: ['Profil', 'Ayarlar', 'Oturumu kapat'],
    })
    expect(['safe', 'uncertain']).toContain(r.level)
    expect(r.level).not.toBe('sensitive')
    expect(r.strongReasons).toEqual([])
  })

  it('(b) claude.ai benzeri giriş yapılmış özel sohbet sayfası: hassas ya da belirsiz (eskiden "hassas değil")', () => {
    const r = detectSensitivePage({
      ...base,
      url: 'https://claude.ai/chat/00000000-0000-0000-0000-000000000000',
      uiTexts: ['Yeni sohbet', 'Sohbetler', 'Projeler'],
      composerCount: 1,
    })
    expect(['sensitive', 'uncertain']).toContain(r.level)
    expect(r.level).toBe('sensitive')
    expect(r.strongReasons.join(' ')).toContain('yapay zekâ sohbet uygulaması')
  })

  it('(b) URL listede olmasa da (bilinmeyen sohbet uygulaması) yazma alanı belirsiz yapar', () => {
    const r = detectSensitivePage({ ...base, url: 'https://bilinmeyen-uygulama.ornek/', uiTexts: ['Yeni sohbet'], composerCount: 1 })
    expect(r.level).toBe('uncertain')
  })
})

describe('matchPrivateApp / matchPrivatePath', () => {
  it.each([
    'https://claude.ai/chat/abc',
    'https://claude.ai/new',
    'https://chatgpt.com/c/abc',
    'https://gemini.google.com/app/abc',
    'https://mail.google.com/mail/u/0/',
    'https://outlook.live.com/mail/0/',
    'https://web.whatsapp.com/',
    'https://docs.google.com/document/d/abc/edit',
    'https://internetsube.ornekbank.com.tr/',
  ])('%s bilinen özel uygulama', (url) => {
    expect(matchPrivateApp(url).length).toBeGreaterThan(0)
  })
  it.each(['https://www.trendyol.com/c/kadin-giyim', 'https://docs.google.com/', 'https://www.claude.com/pricing', 'https://learn.microsoft.com/tr-tr/'])(
    '%s özel uygulama değil',
    (url) => {
      expect(matchPrivateApp(url)).toEqual([])
    },
  )
  it('e-ticaret kategori yolu (/c/…) sohbet yolu sayılmaz', () => {
    expect(matchPrivatePath('https://www.ornek-eticaret.com/c/elektronik')).toBe(false)
    expect(matchPrivatePath('https://ornek.com/chat/123')).toBe(true)
  })
})

describe('matchAccountTexts', () => {
  it('Türkçe büyük/küçük harf ve noktalama farkını yok sayar', () => {
    expect(matchAccountTexts(['  ÇIKIŞ YAP  ', 'Profilim »'])).toEqual(['çıkış yap', 'profilim'])
  })
  it('tek kelimelik ifadeyi yalnızca tam eşleşmede sayar', () => {
    expect(matchAccountTexts(['Acil Çıkış Planı', 'Hesabım ile ilgili sorular'])).toEqual([])
    expect(matchAccountTexts(['Çıkış'])).toEqual(['çıkış'])
  })
  it('çok kelimeli ifadeyi metin içinde bulur', () => {
    expect(matchAccountTexts(['Hoş geldiniz, Ayşe'])).toEqual(['hoş geldiniz'])
  })
  it('İngilizce oturum metinlerini bulur', () => {
    expect(matchAccountTexts(['Sign out', 'My Account'])).toEqual(['my account', 'sign out'])
  })
})

describe('matchUrlPatterns', () => {
  it.each([
    'https://a.com/login',
    'https://a.com/giris-yap?ret=/',
    'https://a.com/tr/hesabim/siparislerim',
    'https://a.com/account/',
    'https://giris.turkiye.gov.tr/Giris/',
    'https://enabiz.gov.tr/Home/Index',
    'https://a.com/odeme',
  ])('%s hassas', (url) => {
    expect(matchUrlPatterns(url).length).toBeGreaterThan(0)
  })
  it.each(['https://a.com/blog/giris-rehberi-yazisi', 'https://a.com/hesaplama-araci', 'https://www.saglik.gov.tr/TR,1/ana-sayfa.html'])(
    '%s hassas değil',
    (url) => {
      expect(matchUrlPatterns(url)).toEqual([])
    },
  )
})

describe('isSensitiveAutocompleteToken', () => {
  it.each(['cc-number', 'cc-csc', 'CC-EXP', 'one-time-code', 'current-password', 'new-password'])('%s hassas', (t) => {
    expect(isSensitiveAutocompleteToken(t)).toBe(true)
  })
  it.each(['email', 'name', 'tel', 'off', 'username'])('%s hassas değil', (t) => {
    expect(isSensitiveAutocompleteToken(t)).toBe(false)
  })
})
