# Sonraki Adımlar — Teslime Kadar Yapılacaklar

Bu rehber, kodun bittiği noktadan teslime kadar **senin** yapman gereken işleri sırasıyla anlatır. Bu adımların hepsi
gerçek çalıştırma, gerçek gözlem ya da kişisel yazı gerektirir. Bu yüzden araç bunları üretmez; değerler yalnızca
senin denemelerinden gelir.

Değerlendirme ağırlıkları hatırlatma (docs/ODEV.md §7): **Doğrulama %25** en yüksek kalem. Sonra eklenti +
deterministik %20, LLM %20, skorlama %15, README/demo/rapor %10, yansıtma %10. Zamanını buna göre böl.

---

## Önerilen sıra ve süre

| # | Adım | Tahmini süre | Çıktı |
|---|---|---|---|
| 1 | Kurulum ve ilk deneme | 30 dk | Eklenti çalışıyor |
| 2 | Site seçimi | 20 dk | 3 herkese açık sayfa |
| 3 | 3 sitenin analizi ve raporları | 1-1,5 saat | `reports/saglik-…`, `eticaret-…`, `kamu-…json` |
| 4 | Tutarlılık testi | 30 dk | `reports/tutarlilik-…json` + README tablosu |
| 5 | Halüsinasyon elle doğrulama | 1 saat | `reports/halusinasyon-…json` + oran |
| 6 | Manuel karşılaştırma (klavye + ekran okuyucu) | 1,5-2 saat | `docs/manuel-karsilastirma.md` |
| 7 | Büyükanne ve Gece 3 testleri | 1 saat | iki şablon dolu |
| 8 | README doğrulama bölümünü doldurma | 30 dk | `TODO` kalmamış README |
| 9 | Demo videosu | 1-2 saat | 3-5 dk video |
| 10 | Yansıtma notu ve AI günlüğü | 1 saat | yarım sayfa not |
| 11 | Son kontrol, commit, push (push: sen) | 20 dk | GitHub repo güncel |

---

## 1. Kurulum ve ilk deneme

1. Terminalde proje klasöründe:
   ```bash
   node -v            # 22.12 veya üstü olmalı
   npm install
   npm run build
   npm test           # 212 birim testi geçmeli
   npm run test:browser  # 20 tarayıcı testi (yüklü Chrome gerekir)
   ```
2. Chrome → `chrome://extensions` → **Geliştirici modu** açık → **Paketlenmemiş öğe yükle** → `dist/` klasörü.
3. Yapboz simgesinden **UX Doktor**'u sabitle.
4. Bir API anahtarı al:
   - **Claude:** [console.anthropic.com](https://console.anthropic.com). Hesapta bakiye ya da kredi olmalı.
   - **Gemini (ücretsiz):** [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
5. Simge → yan panel → **Ayarlar**. Önce **LLM sağlayıcısı**nı seç. Sonra o sağlayıcının kartına anahtarı yapıştır →
   **Kaydet** → **Anahtarı doğrula** → "Anahtar geçerli" mesajını gör.
6. Herhangi bir herkese açık sayfada simgeye **o sekmedeyken** tıkla → **Bu sayfayı analiz et**.

**Maliyet:** Her LLM analizinden sonra panel kullanılan girdi/çıktı token sayısını gösterir. Claude'da gerçek
maliyeti Anthropic Console'daki **Usage** sayfasından izle. Gemini ücretsiz katmanda ücret yoktur ama istek sınırı
vardır; sınırını AI Studio'da görebilirsin. Gemini ücretsiz katmanında gönderilen veri Google tarafından ürün ve model
geliştirmede kullanılabilir, insanlar okuyabilir; yalnızca herkese açık sayfaları analiz et.

Hangi sağlayıcıyı ve modeli kullandıysan raporda ve README'de aynısını yaz. Tutarlılık testini de aynı modelle yap.

### Sık karşılaşılabilecek sorunlar

| Belirti | Ne yapmalı |
|---|---|
| "Bu sekmeye erişim izni yok" | Analiz edeceğin sekmedeyken araç çubuğundaki simgeye tekrar tıkla. Olmazsa paneldeki **Site erişim izni ver ve tekrar dene** düğmesini kullan (izni sonra Ayarlar'dan geri alabilirsin). Hangisinin gerektiğini not et; README "Bilinen sınırlamalar" için faydalı. |
| "Tarayıcının kendi sayfaları analiz edilemez" | `chrome://` ya da Web Mağazası sayfasındasın; normal bir web sitesine geç. |
| "API anahtarı geçersiz (401)" | Anahtarı yeniden kopyala; başında/sonunda boşluk olmasın. |
| "İstek sınırına takıldınız (429)" | Bir dakika bekle, tekrar dene. |
| "Model isteği reddetti (refusal)" | Nadiren olur. Aynı isteği tekrar dene; tekrarlarsa not al (sınırlama olarak yazılabilir). |
| Analizden sonra sayfa değişti, "öğe bulunamadı" | Sayfayı yenileyip **Bu sayfayı analiz et** ile baştan başla. |
| Kod değiştirdiysen | `npm run build`, sonra `chrome://extensions` sayfasında eklentinin yenile (↻) düğmesi, sonra yan paneli kapatıp aç. |

Bir hata kalıcı ise hata metnini (ve mümkünse service worker konsolunu: `chrome://extensions` → UX Doktor →
"service worker" bağlantısı) Claude'a gönder.

---

## 2. Site seçimi

Ödev her kategoriden en az bir site istiyor: **sağlık, Türk e-ticaret, kamu hizmeti**.

Seçim kuralları:
- **Yalnızca herkese açık sayfalar.** Giriş yapma, hesap sayfalarına girme, form doldurma. e-Devlet giriş, e-Nabız,
  MHRS oturum sayfaları gibi sayfaları kullanma.
- Her kategoride içinde **etkileşimli öğe ve form/menü bulunan** bir sayfa seç (ör. hastanenin "Randevu
  bilgilendirme" ya da "Bölümler" sayfası, e-ticarette bir ürün listeleme ya da ürün detay sayfası, belediyenin bir
  hizmet başvuru bilgilendirme sayfası). Boş ya da tek paragraflık sayfa az bulgu verir.
- Sağlık sitesini dikkatli seç: Büyükanne ve Gece 3 testleri de bu sitede yapılacak. Acil iletişim bilgisi, telefon
  numarası ve randevu yönlendirmesi olan bir site bu iki test için uygundur.

Her site için şu bilgileri bir yere not et: URL, tarih/saat, tarayıcı sürümü, pencere genişliği. Analizlerde pencere
genişliğini sabit tut; envanter, ilk ekranda görünürlük gibi bilgileri pencere boyutuna göre çıkarır.

**Hassas sayfa uyarısı:** Bazı e-ticaret sitelerinde "Hesabım" bağlantısı oturum açık olmasa bile görünür ve araç
LLM gönderimini kilitler. Sayfa gerçekten herkese açıksa onay kutusunu işaretleyip devam edebilirsin. Onay ve zamanı
rapora kaydedilir. Bunu README'de "hassas sayfa tespiti yanlış alarm verdi" diye örnek olarak kullanabilirsin.

---

## 3. Üç sitenin analizi ve raporları

Her site için aynı protokolü uygula:

1. Sayfayı aç, çerez bandı varsa kapat (ne yaptığını not et), simgeye tıkla.
2. **Bu sayfayı analiz et** → deterministik bulgular ve skorlar gelir.
3. Gizlilik satırına bak (hassas değil / kilitli). Kilitliyse yukarıdaki uyarıya göre karar ver.
4. **LLM analizi için gönderimi hazırla** → onay ekranında JSON'a göz at. Ad, telefon, e-posta, form değeri görürsen
   **gönderme**, not al ve Claude'a bildir. Sorun yoksa **Gönder**.
5. En önemli 3-5 bulgu için (her iki katmandan) **Kanıt görüntüsü al**. Görüntüler rapora girer.
6. **Raporu JSON olarak indir**.
7. İndirme klasöründeki `ux-doktor-…json` dosyasını `reports/` klasörüne kopyala ve yeniden adlandır:
   `saglik-<site>.json`, `eticaret-<site>.json`, `kamu-<site>.json`.
8. README'deki "Test edilen siteler" tablosunu, rapordaki `scores.deterministic.score`, `scores.llm.score` ve
   `scores.overall` değerleriyle doldur.

Raporların içini **elle düzenleme**. Bir şey ters giderse analizi baştan yap.

---

## 4. Tutarlılık testi (Ödev 4.a)

1. Bir sayfa seç (öneri: sağlık sayfası).
2. Panelde **Doğrulama araçları** → çalıştırma sayısı. En az 3 gerekli; 5 daha güvenilir sonuç verir ama maliyeti
   artırır.
3. **Aynı sayfayı N kez analiz et** → onay ekranında N'yi gör → **Gönder**. Çalıştırmalar sırayla gider; bitmesini
   bekle.
4. **Tutarlılık sonuçlarını JSON olarak indir** → `reports/tutarlilik-<site>.json` olarak kaydet.
5. README tablosu için:
   ```bash
   node scripts/tutarlilik-tablosu.mjs reports/tutarlilik-<site>.json
   ```
   Çıkan Markdown tablosunu README "a) Tutarlılık testi" bölümüne yapıştır.

**Sapma 10 puanı aşarsa** (betik "Eşik aşıldı mı: EVET" der):
- Betiğin sonunda **cevabı değişen sorular** listelenir. Sapmanın nedeni bunlardır. Her biri için gerekçelere bak
  (raporda/JSON'da `rawResponse`).
- Olası nedenler:
  - soru belirsiz yazılmış olabilir,
  - envanter o soru için yetersiz olabilir (ör. "belirsiz" ile "evet" arasında gidip gelme),
  - envanter kesilmiş olabilir,
  - yedek model devreye girmiş olabilir (`servedModel` farklıysa).
- Çözümü sen seç ve uygula. Örnek: ilgili rubrik sorusunu netleştirmek (`src/shared/rubric.ts`, ardından
  `PROMPT_VERSION`'ı `norman-rubrik-v2` yap). Sonra testi **yeniden çalıştır** ve iki sonucu (önce/sonra) README'de
  göster. Rubriği değiştirirsen Claude'dan yardım isteyebilirsin. Ama ölçümü sen çalıştırırsın ve sayılar dosyadan
  gelir.
- Sapma 10'un altındaysa bunu da açıkça yaz ("en büyük aralık X puan, eşik altında").

---

## 5. Halüsinasyon kontrolü (Ödev 4.c)

Otomatik kısım her LLM analizinde zaten yapılıyor. Panelde "Halüsinasyon (otomatik kontrol)" satırı ve raporun
`llm.hallucination` alanı bunu gösterir. Senin işin elle doğrulama:

1. Her site için LLM analizinden sonra **Elle doğrulama listesini JSON olarak indir** →
   `reports/halusinasyon-<site>.json`.
2. Dosyayı bir editörde aç. Her `items[]` öğesi için:
   - Panelde ilgili bulgunun **Sayfada göster** düğmesine bas (ya da DevTools konsolunda
     `document.querySelector('<selector>')`).
   - Öğe sayfada var mı ve gerekçe doğru mu?
     - Doğruysa `"gercekMi": true` yaz.
     - Öğe yoksa, yanlış öğeyse ya da iddia yanlışsa `"gercekMi": false` yaz.
   - `"not"` alanına kısa bir açıklama yaz.
3. Oranı hesapla:
   ```bash
   node scripts/halusinasyon-orani.mjs reports/halusinasyon-*.json
   ```
   Betik boş kalan alan varsa uyarır.
4. README "c) Halüsinasyon kontrolü" tablosunu betiğin çıktısıyla doldur. İki aşamayı ayrı yaz: otomatik (envanterde
   olmayan atıf oranı) ve elle (var olmayan/yanlış öğeye işaret eden bulgu oranı).

---

## 6. Manuel karşılaştırma (Ödev 4.b)

Şablon: `docs/manuel-karsilastirma.md`.

**Hazırlık:**
- Ekran okuyucu: Windows'ta ücretsiz [NVDA](https://www.nvaccess.org/) ya da yerleşik Ekran Okuyucusu
  (Ctrl+Win+Enter).
- Temel NVDA tuşları: `Tab` / `Shift+Tab` (odaklanılabilir öğeler), `H` (başlıklar), `D` (landmark'lar), `F` (form
  alanları), `NVDA+F7` (öğe listesi), `NVDA+Space` (tarama/odak kipi).

**Yapılış:**
1. Raporu olan sitelerden birini seç.
2. **En az 1 görev** tanımla (ör. "Ana sayfadan kardiyoloji bölümünün telefon numarasına ulaşmak"). Görevi **yalnızca
   klavye** ile ve **ekran okuyucu açıkken** yap. Her adımı şablondaki tabloya yaz: ne tuşladın, ekran okuyucu ne
   okudu, sorun var mı.
3. Aracın bu sayfadaki bulgularını (rapor JSON'u ya da panel) tek tek gözden geçir:
   - Gerçekten sorun mu? → **Yakalandı**
   - Sorun değil mi? → **Yanlış alarm**
4. Senin bulup aracın bulmadığı sorunları ekle → **Kaçırdı**. Tipik örnekler: klavye tuzağı, odak göstergesinin
   görünmemesi, mantıksız odak sırası, ekran okuyucunun okumadığı dinamik içerik, açılır pencerenin odağı almaması.
   Bunlar statik analizin sınırlarıdır ve README "Bilinen sınırlamalar" ile bağlantı kurmak için iyi örneklerdir.
5. Şablonun "Özet" tablosunda yakalanan/kaçırılan/yanlış alarm sayılarını ve kesinlik/duyarlılığı hesapla; README'ye
   aktar.

---

## 7. Büyükanne ve Gece 3 Acil Durum testleri (Ödev 4.d)

Şablonlar: `docs/buyukanne-testi.md`, `docs/gece-3-acil-durum-testi.md`. İkisi de **sağlık sitesinde** yapılır.

**Büyükanne Testi:**
- Senaryoyu canlandır: yaşlı, az teknoloji bilen, görmesi zayıf biri.
- Tarayıcıyı %200 yakınlaştır (Ctrl + +), görevi acele etmeden dene.
- Şablondaki her maddeyi önce kendin değerlendir, sonra raporda aracın bunu yakalayıp yakalamadığına bak (ilgili
  bulgu kimliğini yaz).

**Gece 3 Acil Durum Testi:**
- Telefonda ya da DevTools'ta mobil görünümle dene (F12 → cihaz simgesi → ör. 390 px genişlik). Ekran parlaklığını
  düşür.
- Gerçek zaman ölç: acil telefon numarasına ya da nöbetçi eczane bilgisine kaç saniyede, kaç dokunuşla ulaştın?
- İstersen sayfayı mobil genişlikte ayrıca analiz et. İlk ekran ve dokunma hedefi bulguları değişebilir; bunu ayrı
  rapor olarak kaydet ve dosya adında belirt.

Her iki testin sonunda şunları yaz:
- aracın yakaladığı kritik sorun,
- aracın kaçırdığı kritik sorun,
- kaçırmanın nedeni (ör. statik analiz, rubrikte olmayan konu, envanter kesilmesi).

README "d)" tablosuna özetle.

---

## 8. README'yi doldurma

README'de `TODO: gerçek ölçüm` geçen her yeri doldur. Kontrol:

```bash
git grep -n "TODO: gerçek ölçüm" -- README.md docs/
```

Bu komut, şablonlar dahil hiçbir sonuç döndürmemeli. Doldurmadığın bir alan kaldıysa nedenini yaz (ör. "ölçülmedi").
Uydurma değer yazma.

"Bilinen sınırlamalar" bölümüne kendi gözlemlerini ekleyebilirsin (ör. activeTab'ın yan panelde gerçekte nasıl
davrandığı, hangi sitede neyin kaçırıldığı).

---

## 9. Demo videosu (3-5 dakika)

Önerilen akış:

| Süre | İçerik |
|---|---|
| 0:00-0:30 | Amaç: "AI'a puan sordurmak değil, kanıtlı ve doğrulanabilir tanı." İki katman. |
| 0:30-1:30 | Sağlık sayfasında analiz: deterministik bulgular, **Sayfada göster** ile vurgulama, kanıt görüntüsü, skor kartları. |
| 1:30-2:30 | LLM: onay ekranında maskelenmiş JSON (form değeri yok), Gönder, rubrik cevapları, kanıt öğe kimlikleri, halüsinasyon satırı. |
| 2:30-3:15 | Gizlilik: bir giriş sayfasında kilit ve açık onay. |
| 3:15-4:15 | Doğrulama: tutarlılık testi sonucu tablosu, halüsinasyon oranı, manuel karşılaştırma özeti. |
| 4:15-5:00 | Skor formülü (README), sınırlamalar, kapanış. |

Kayıt için: Windows'ta Win+Alt+R (Xbox Game Bar) ya da OBS. Videoda API anahtarının görünmediğinden emin ol
(Ayarlar sayfasını kayıtta açma ya da anahtar alanı boşken göster). Bağlantıyı README'deki teslim tablosuna ekle.

---

## 10. Yansıtma notu ve AI günlüğü

Bunları **sen** yazarsın; Claude bu dosyalara içerik eklemez. Yarım sayfalık yansıtma notunda ödev üç soruyu soruyor:
AI nerede yardım etti, nerede yanılttı, bunu nasıl fark ettin.

Hatırlamana yardımcı olabilecek kaynaklar:
- `git log`: hangi işin hangi commit'te yapıldığı.
- Bu oturumda alınan kararlar:
  - temperature yerine effort sabitlemek,
  - activeTab belirsizliği ve isteğe bağlı izin yedeği,
  - CRXJS'in betiği `web_accessible_resources` listesine eklemesi,
  - maskeleme testlerinin yakaladığı sıralama hatası,
  - textarea içeriğinin kanıt HTML'ine sızması.
- Kendi gerçek denemelerinde gördüğün aksaklıklar ve Claude'un yanlış ya da eksik söylediği yerler.

AI günlüğü (`docs/ai-gunlugu.md`) için: hangi istemi verdin, ne çıktı, neyi kabul ettin, neyi değiştirdin. Kısa
maddeler yeterli.

---

## 11. Son kontrol, commit ve push

Teslimden önce:

```bash
npm run build
npm run typecheck
npm test
npm run test:browser
git status                         # beklenmeyen dosya yok mu?
git grep -n "sk-ant-api" || echo "anahtar yok"   # gerçek anahtar repoda OLMAMALI
git grep -n "<Gemini anahtarının ilk 10 karakteri>" || echo "anahtar yok"   # Gemini kullandıysan
```

Kontrol listesi:

- [ ] `reports/` altında 3 site raporu (+ tutarlılık ve halüsinasyon dosyaları)
- [ ] README doğrulama bölümü dolu, `TODO: gerçek ölçüm` kalmadı
- [ ] `docs/manuel-karsilastirma.md`, `docs/buyukanne-testi.md`, `docs/gece-3-acil-durum-testi.md` dolu
- [ ] Demo videosu bağlantısı README'de
- [ ] Yansıtma notu (yarım sayfa) hazır
- [ ] `docs/GEREKSINIMLER.md` içinde "Öğrenci" satırlarının durumunu güncelle
- [ ] Commit geçmişi anlamlı (tek commit değil); mesajlar Türkçe ve `feat:/fix:/docs:/test:/chore:` önekli

Commit örnekleri:

```bash
git add reports/
git commit -m "docs: üç sitenin gerçek analiz raporlarını ekle"
git add README.md docs/
git commit -m "docs: doğrulama sonuçlarını ve test şablonlarını doldur"
```

Repo GitHub'a bağlı: https://github.com/HakanKoco/UX-DOCTOR-CHROME (`origin`, dal `master`). **Push'u sen yaparsın.** Claude yalnızca commit atar. Push'tan önce yukarıdaki kontrolleri çalıştır, sonra:

```bash
git log --oneline origin/master..master   # gönderilecek commit'ler
git push origin master                     # force push yapma
```

Push'tan sonra GitHub'da README'nin (Mermaid şeması dahil) düzgün göründüğünü kontrol et.
