// Bilinen üçüncü taraf çerez/onay bileşenleri. Bu bileşenlerdeki bulgular yalnızca ETİKETLENİR: skor hesabından
// düşülmez, bulgu silinmez (öğrenci kararı). Etiket, Ödev 4.b manuel karşılaştırmasında yanlış alarm / site sahibinin
// doğrudan kontrol etmediği kod ayrımı için kullanılır.
//
// Kaynak: kök öğe kimlikleri/sınıfları resmi bir dokümandan değil, sağlayıcıların sayfaya ekledikleri bilinen DOM
// kalıplarından alınmıştır (cookieseal: öğrencinin acibadem.com.tr gözlemi). Kalıp değişebilir; liste eksik olabilir.
// Test: tests/fixtures/ucuncu-taraf.html (yalnızca kendi kurgu sayfamızda doğrulanır).

export interface ThirdPartyComponent {
  vendor: string
  kind: 'cookie-consent'
  /** Bileşenin kök öğesine uyan CSS seçici (öğe ya da atası bununla eşleşirse etiketlenir). */
  rootSelector: string
}

export const THIRD_PARTY_COMPONENTS: readonly ThirdPartyComponent[] = [
  { vendor: 'CookieSeal', kind: 'cookie-consent', rootSelector: '[id^="cookieseal"], [class*="cookieseal"]' },
  { vendor: 'OneTrust', kind: 'cookie-consent', rootSelector: '#onetrust-consent-sdk, #onetrust-banner-sdk' },
  { vendor: 'Cookiebot', kind: 'cookie-consent', rootSelector: '#CybotCookiebotDialog' },
  { vendor: 'Usercentrics', kind: 'cookie-consent', rootSelector: '#usercentrics-root, #usercentrics-cmp-ui' },
  { vendor: 'Didomi', kind: 'cookie-consent', rootSelector: '#didomi-host' },
  { vendor: 'CookieYes', kind: 'cookie-consent', rootSelector: '.cky-consent-container' },
  { vendor: 'Quantcast Choice', kind: 'cookie-consent', rootSelector: '.qc-cmp2-container' },
]

export interface ThirdPartyTag {
  vendor: string
  kind: 'cookie-consent'
}

/** Öğe (ya da bir atası) bilinen bir üçüncü taraf bileşenine aitse etiketi; değilse null. */
export function thirdPartyOf(el: Element | null | undefined): ThirdPartyTag | null {
  if (!el) return null
  for (const c of THIRD_PARTY_COMPONENTS) {
    try {
      if (el.closest(c.rootSelector)) return { vendor: c.vendor, kind: c.kind }
    } catch {
      // Geçersiz seçici olamaz (sabit liste), ama tarayıcı farkı ihtimaline karşı yutulur.
    }
  }
  return null
}

export const THIRD_PARTY_KIND_LABELS: Record<ThirdPartyTag['kind'], string> = {
  'cookie-consent': 'çerez/onay bileşeni',
}
