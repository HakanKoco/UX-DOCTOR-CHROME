import { describe, expect, it } from 'vitest'
import {
  detectSensitivePage,
  isSensitiveAutocompleteToken,
  matchAccountTexts,
  matchUrlPatterns,
  type SensitivitySignals,
} from './sensitivity'

const base: SensitivitySignals = {
  url: 'https://www.ornek-hastane.com.tr/bolumler/kardiyoloji',
  passwordFieldCount: 0,
  autocompleteTokens: [],
  uiTexts: ['Ana Sayfa', 'Bölümlerimiz', 'Online Randevu', 'İletişim'],
}

describe('detectSensitivePage', () => {
  it('herkese açık sayfayı hassas saymaz', () => {
    expect(detectSensitivePage(base)).toEqual({ sensitive: false, reasons: [] })
  })

  it('şifre alanı varsa hassas sayar', () => {
    const r = detectSensitivePage({ ...base, passwordFieldCount: 1 })
    expect(r.sensitive).toBe(true)
    expect(r.reasons[0]).toContain('Şifre alanı')
  })

  it('kart ve tek kullanımlık kod autocomplete alanlarını yakalar', () => {
    const r = detectSensitivePage({ ...base, autocompleteTokens: ['shipping', 'cc-number', 'one-time-code', 'email'] })
    expect(r.sensitive).toBe(true)
    expect(r.reasons[0]).toContain('cc-number')
    expect(r.reasons[0]).toContain('one-time-code')
    expect(r.reasons[0]).not.toContain('email')
  })

  it('oturum metinlerini yakalar', () => {
    const r = detectSensitivePage({ ...base, uiTexts: [...base.uiTexts, 'Hesabım', 'Çıkış Yap'] })
    expect(r.sensitive).toBe(true)
    expect(r.reasons[0]).toContain('"hesabım"')
    expect(r.reasons[0]).toContain('"çıkış yap"')
  })

  it('giriş URL kalıbını yakalar', () => {
    const r = detectSensitivePage({ ...base, url: 'https://www.ornek.com/uye-girisi' })
    expect(r.sensitive).toBe(true)
    expect(r.reasons[0]).toContain('giriş sayfası')
  })

  it('birden çok sinyali ayrı gerekçe olarak listeler', () => {
    const r = detectSensitivePage({
      url: 'https://ornek.com/hesabim/randevularim',
      passwordFieldCount: 2,
      autocompleteTokens: ['new-password'],
      uiTexts: ['Randevularım'],
    })
    expect(r.reasons).toHaveLength(4)
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
