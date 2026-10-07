# Büyükanne Testi (Ödev 4.d)

> Bu şablonu öğrenci doldurur. Değerler yalnızca gerçek denemeden gelir. "Sayfada sorun var mı?" sütunu öğrencinin
> gözlemidir; "Araç yakaladı mı?" sütunu `reports/saglik-acibadem.json` raporundan alınmıştır. Kesin gözlem olmayan
> maddeler "kontrol edilmedi" olarak bırakılmıştır.

## Senaryo

Teknolojiye az alışkın, görmesi ve ince motor becerisi zayıflamış 70 yaş üstü bir kullanıcı, sağlık sitesinde kendi
başına bir işi (ör. randevu bilgisine ulaşmak, bir bölümün telefonunu bulmak) tamamlamaya çalışıyor. Yardım
isteyecek kimse yok.

| Alan | Değer |
|---|---|
| Sağlık sitesi ve sayfa (yalnızca herkese açık) | Acıbadem Sağlık Grubu, ana sayfa — https://www.acibadem.com.tr/ |
| Denenen görev | Ana sayfadan randevu almanın yolunu ya da randevu telefon numarasını bulmak |
| Koşullar | Masaüstü Chrome, %200 yakınlaştırma |
| Tarih | 2026-10-07 |
| Karşılaştırılan rapor (`reports/…json`) | `reports/saglik-acibadem.json` (analiz pencere genişliği 1078 px) |

## Kontrol listesi

| # | Kontrol | Sayfada sorun var mı? | Araç yakaladı mı? (Evet / Hayır / Uygulanamaz) | İlgili bulgu (kimlik, kural) | Not |
|---|---|---|---|---|---|
| 1 | Metin yeterince büyük ve okunaklı mı (yazı boyutu, satır aralığı)? | Yok (kısmen): %200'de yazılar okunuyor, ama bazı bölümlerde sayfanın tamamını görmek için yatay/dikey kaydırmak gerekiyor | Hayır | — (LLM V5: yazı boyutları 12 px ve üzeri, "evet") | Yakınlaştırmada yatay kaydırma (WCAG 1.4.10 Reflow) axe kurallarında ve rubrikte yok |
| 2 | Metin/arka plan kontrastı yeterli mi? | Var: bazı açık renkli yazılar beyaz zeminde zor okunuyor | Evet | `color-contrast` (WCAG 1.4.3), 12 öğe | Gözlemle uyumlu |
| 3 | Düğme ve bağlantılar parmakla/titrek elle tıklanabilecek boyutta mı (≥ 24×24 px, tercihen 44×44 px)? | Yok (kısmen): "Randevu Al" gibi ana düğmeler büyük; bazı küçük simgelere tıklamak daha zor | Kısmen | `target-size` (WCAG 2.5.8), 1 öğe; LLM A4: "evet" (E72 "Randevu Al", 48×130 px) | Araç yalnızca 24 px altını ölçer; 24–44 px arası küçük simgeler bulgu üretmez |
| 4 | Dil sade mi; tıbbi/teknik terim ve kısaltma açıklanmış mı? | Var: bazı içeriklerde herkesin anlayamayacağı tıbbi terimler var | Hayır | — | Rubrikte dil sadeliği sorusu yok; envanter yalnızca etkileşimli öğe, başlık ve landmark içerir |
| 5 | Görevin adım sayısı az mı; birincil eylem ilk ekranda görünüyor mu? | Yok: "Randevu Al" sayfanın üst kısmında; görev yaklaşık 1-2 tıklama | Uygulanamaz (sorun yok) | LLM V3: "evet" (E72 "Randevu Al" ilk ekranda) | Araç ile gözlem uyumlu |
| 6 | Simgelerin yanında metin var mı (yalnızca ikonlu düğme yok mu)? | Var: ok ve arama gibi yalnızca simgeden oluşan düğmelerin ne işe yaradığı ilk bakışta anlaşılmıyor | Evet | `button-name` (WCAG 4.1.2, Kritik), 12 öğe; `link-name` (WCAG 2.4.4), 5 öğe; LLM V4 (E80, adsız düğme) | Araç adsız düğmeyi erişilebilir ad açısından yakalar; görsel anlaşılırlığı ölçmez |
| 7 | Form alanlarının görünür etiketi ve anlaşılır hata mesajı var mı? | Yok: arama kutusunda "Acıbadem'de arayın" ifadesi var | Uygulanamaz (gözlemde sorun yok) | LLM M1 ve C2 (E70): etiket yalnızca placeholder | Araç sorun bildirdi, gözlem sorun görmedi. Placeholder yazmaya başlayınca kaybolur; hata mesajı denenmedi (analiz salt okunur) |
| 8 | Açılır pencere, otomatik kayan içerik ya da süre sınırı kullanıcıyı şaşırtıyor mu? | Var: hareketli/kayan içerikler ve açılır içerikler dikkat dağıtıyor; görevi engellemedi | Hayır | — | Otomatik kayan içerik (WCAG 2.2.2) statik analizde ölçülmüyor |
| 9 | Telefon numarası tıklanabilir (`tel:`) ve kolay bulunur mu? | Yok (kısmen): iletişim bilgilerine ulaşılabildi; ana sayfadaki belirginliği ve `tel:` bağlantısı kontrol edilmedi | Hayır | — | Rubrikte `tel:` / iletişim bilgisi sorusu yok |

## Sonuç

- Aracın yakaladığı kritik sorun(lar): Düşük kontrastlı metinler (`color-contrast`, 12 öğe) ve yalnızca simgeden
  oluşan, adı olmayan düğmeler (`button-name` 12 öğe, Kritik; LLM V4). İkisi de öğrencinin gözlemiyle örtüşüyor.
- Aracın kaçırdığı kritik sorun(lar): Tıbbi terimlerin açıklanmaması, %200 yakınlaştırmada yatay kaydırma
  gereksinimi, otomatik kayan içeriğin dikkat dağıtması.
- Kaçırmanın nedeni: Dil sadeliği rubrikte yok ve envanter metin içeriğini kapsamıyor; yakınlaştırma ve reflow
  davranışı ile kayan içerik statik analizle (tek pencere genişliği, etkileşimsiz) ölçülmüyor.
