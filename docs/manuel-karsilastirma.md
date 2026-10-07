# Manuel Karşılaştırma (Ödev 4.b)

> Bu şablonu öğrenci doldurur. Değerler yalnızca gerçek elle denetimden gelir; `TODO: gerçek ölçüm` alanlarını
> denetimi yaptıktan sonra doldurun.
>
> Bölüm 3'teki satırlar öğrencinin iki gerçek elle denetiminden gelir: (a) Acıbadem LLM bulgularının DevTools ile
> elle doğrulanması (`reports/halusinasyon-acibadem.json`, `gercekMi`/`not` alanları) ve (b) Büyükanne ve Gece 3
> testlerindeki sayfa gözlemleri ([buyukanne-testi.md](buyukanne-testi.md),
> [gece-3-acil-durum-testi.md](gece-3-acil-durum-testi.md)). Klavye + ekran okuyucu görevinin (Bölüm 2) bulguları
> eklendiğinde tablo ve özet güncellenir.

## 1. Denetim bilgileri

| Alan | Değer |
|---|---|
| Sayfa (URL, yalnızca herkese açık) | https://www.acibadem.com.tr/ (ana sayfa) |
| Site kategorisi (sağlık / e-ticaret / kamu) | Sağlık |
| Denetim tarihi ve saati | 2026-10-07 (DevTools doğrulaması, Büyükanne ve Gece 3 testleri); ekran okuyucu görevi: TODO: gerçek ölçüm |
| Tarayıcı ve sürümü | TODO: gerçek ölçüm |
| Ekran okuyucu ve sürümü (ör. NVDA, Windows Ekran Okuyucusu) | TODO: gerçek ölçüm |
| UX Doktor sürümü / model / prompt sürümü | 1.0.0 / gemini-3.5-flash-lite / norman-rubrik-v1 |
| Karşılaştırılan rapor dosyası (`reports/…json`) | `reports/saglik-acibadem.json` |

## 2. Görev (klavye + ekran okuyucu, en az 1 görev)

Görev tanımı: TODO: gerçek ölçüm (ör. "Ana sayfadan kardiyoloji bölümü için randevu sayfasına ulaşmak")

| Adım | Klavye ile yapılan (Tab, Shift+Tab, Enter, ok tuşları…) | Ekran okuyucunun okuduğu | Sorun var mı? Açıklama |
|---|---|---|---|
| 1 | TODO: gerçek ölçüm | TODO: gerçek ölçüm | TODO: gerçek ölçüm |
| 2 | TODO: gerçek ölçüm | TODO: gerçek ölçüm | TODO: gerçek ölçüm |
| 3 | TODO: gerçek ölçüm | TODO: gerçek ölçüm | TODO: gerçek ölçüm |

Görev tamamlandı mı? TODO: gerçek ölçüm

## 3. Karşılaştırma tablosu

Her satır bir sorundur: ya elle bulunmuştur ya da aracın bildirdiği bir bulgudur.

- **Yakalandı:** Elle doğrulanan gerçek bir sorun ve araç da bildirdi.
- **Kaçırdı:** Elle bulunan gerçek bir sorun ama araç bildirmedi.
- **Yanlış alarm:** Araç bildirdi ama elle kontrol edildiğinde sorun değil.

Aracın elle doğrulanmamış bulguları (ör. `list`/`listitem` 85 öğe, `meta-viewport`, `link-name`, `target-size`)
tabloya ve özete alınmadı.

| # | Sorun | Kaynak (elle / araç-deterministik / araç-LLM) | Araç sonucu (Yakalandı / Kaçırdı / Yanlış alarm) | Araçtaki bulgu kimliği ve kural (ör. `D-color-contrast-1`, WCAG 1.4.3) | Kanıt (seçici, ekran görüntüsü) | Üçüncü taraf mı? (rapordaki `thirdParty`; ör. çerez bandı) | Not |
|---|---|---|---|---|---|---|---|
| 1 | Yalnızca simgeden oluşan, adı olmayan düğmeler | araç-deterministik + araç-LLM; elle | Yakalandı | `button-name` (WCAG 4.1.2, Kritik, 12 öğe); L-V4 (E80) | `div:nth-of-type(8) > div > div > button` (DevTools: metin boş, aria-label yok) | Hayır | Büyükanne #6 gözlemiyle örtüşüyor |
| 2 | Açık renkli metinlerde düşük kontrast | araç-deterministik; elle | Yakalandı | `color-contrast` (WCAG 1.4.3, 12 öğe) | Rapordaki `color-contrast` seçicileri | Hayır | Büyükanne #2 ve Gece 3 #3 (kısık parlaklık) gözlemleriyle örtüşüyor |
| 3 | Arama kutusunun programatik etiketi yok, yalnızca placeholder | araç-LLM | Yakalandı | L-M1 (E70) | DevTools: `labels` 0, aria-label yok, placeholder "Acıbadem'de arayın" | Hayır | axe placeholder'ı ad saydığı için ihlal vermedi; Büyükanne #7'de görsel olarak sorun görülmedi |
| 4 | Arama kutusu `type="search"` değil | araç-LLM | Yakalandı | L-C2 (E70) | DevTools: `type` attribute yok (varsayılan text) | Hayır | Düşük etkili |
| 5 | Sayfada birden fazla h1 | araç-LLM | Yakalandı | L-M4 (E4, E42) | DevTools: `document.querySelectorAll('h1').length` = 6 | Hayır | — |
| 6 | Arama kutusu "zorunlu" olarak işaretlenmemiş | araç-LLM | Yanlış alarm | L-F2 (E70) | DevTools: `required` yok | Hayır | Arama kutusunun zorunlu olması gerekmiyor; soru alana uymuyor |
| 7 | "Eğitim" başlığı tıklanamaz ama `cursor: pointer` | araç-LLM | Yanlış alarm | L-A5 (E48) | DevTools: h6 bir `a` öğesinin içinde | Hayır | Öğe gerçekten tıklanabilir |
| 8 | Tıbbi terimler açıklanmamış | elle | Kaçırdı | — | Büyükanne #4 | Hayır | Rubrikte dil sadeliği yok; envanter metin içeriğini kapsamıyor |
| 9 | %200 yakınlaştırmada yatay/dikey kaydırma gerekiyor | elle | Kaçırdı | — | Büyükanne #1 | Hayır | Reflow (WCAG 1.4.10) ölçülmüyor |
| 10 | Otomatik kayan/hareketli içerik dikkat dağıtıyor | elle | Kaçırdı | — | Büyükanne #8 | Hayır | Statik analiz; WCAG 2.2.2 ölçülmüyor |
| 11 | Acil servis numarası mobil ilk ekranda değil (~40 sn, 3 tıklama) | elle | Kaçırdı | — | Gece 3 #1 | Hayır | Rubrikte yok; analiz masaüstü genişliğinde (1078 px) |
| 12 | Acil bilgiye giden yolun adı belirgin değil | elle | Kaçırdı | — (LLM M2 "evet" dedi) | Gece 3 #4 | Hayır | Rubrik belirsiz bağlantı metnini arar, acil yolun belirginliğini sormaz |

## 4. Özet

| Ölçü | Değer |
|---|---|
| Yakalanan | 5 |
| Kaçırılan | 5 |
| Yanlış alarm | 2 |
| Kesinlik = yakalanan / (yakalanan + yanlış alarm) | 5 / 7 = %71.4 |
| Duyarlılık = yakalanan / (yakalanan + kaçırılan) | 5 / 10 = %50.0 |

Değerlendirme (aracın en çok neyi kaçırdığı, neden): Araç, kod ile ölçülebilen sorunları (adsız düğme, kontrast,
etiket, başlık yapısı) elle gözlemle örtüşecek şekilde yakaladı. Kaçırılan 5 sorunun hepsi içerik ve bağlam
gerektiriyor: dil sadeliği, yakınlaştırmadaki yerleşim, hareketli içerik, mobil ilk ekran ve acil bilginin
bulunabilirliği. Bunlar rubrikte yok ya da statik, tek pencere genişliğinde yapılan analizle görülemiyor. İki yanlış
alarmın ikisi de LLM katmanından; ikisinde de öğe doğru, ama soru öğeye uymuyor (F2) ya da öğenin bağlamı (bağlantı
içinde olması) görülmemiş (A5). Ekran okuyucu görevi: TODO: gerçek ölçüm
