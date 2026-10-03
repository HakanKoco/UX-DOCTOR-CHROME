# UX Tanı Eklentisi — Claude Code Proje Kuralları

Bu repo bir üniversite ödevidir. Ödevin tam metni: @docs/ODEV.md
Ödev metni ile bu dosya çelişirse ödev metni geçerlidir; çelişkiyi bana bildir.
Gereksinim takibi: docs/GEREKSINIMLER.md (her fazda güncellenir).

## Çalışma şekli
- Fazlar halinde ilerliyoruz. Her fazdan önce plan sun, onay almadan uygulamaya geçme.
- Bir faz bitince DUR. Bir sonraki faza kendiliğinden geçme.
- Faz sonunda iki şey yaz: (1) yaptıklarını öğrencinin hocaya anlatabileceği sadelikte 5-10 maddelik Türkçe özet, (2) Chrome'da elle nasıl test edileceği, adım adım.
- Emin olmadığın API ayrıntılarını (Chrome Extensions API, Claude API, axe-core, CRXJS) tahmin etme. Resmi dokümantasyondan doğrula ve kaynağı söyle.
- Yeni bir npm bağımlılığı eklemeden önce neden gerektiğini tek cümleyle söyle.
- Belirsiz bir noktada varsayım yapmak yerine sor.
- Kullanıcıyla Türkçe konuş. Kod tanımlayıcıları İngilizce, kod yorumları ve arayüz metinleri Türkçe.

## Sabit teknoloji kararları (değiştirme)
- Chrome Extension Manifest V3, TypeScript, Vite + @crxjs/vite-plugin, React.
- Arayüz: chrome.sidePanel (popup değil). Ayrı bir ayarlar sayfası (options page).
- LLM: Claude API, service worker'dan doğrudan çağrılır. Tarayıcıdan çağrı için gereken başlıkları resmi dokümandan doğrula.
- API anahtarını kullanıcı ayarlar sayfasında girer, `chrome.storage.local` içinde tutulur (`sync` değil).
- Model adı ayarlar sayfasından seçilebilir. Varsayılanı güncel dokümantasyondan seç.
- LLM'e YALNIZCA maskelenmiş DOM özeti gider. Ekran görüntüsü LLM'e gönderilmez.
- İzinler en az düzeyde tutulur. Her izin README'de gerekçelendirilir.

## Kesin yasaklar (ödevde ihlali notu sıfırlıyor)
- API anahtarı hiçbir dosyaya yazılmaz, loglanmaz, commit edilmez. Test kodunda bile gerçek anahtar olmaz.
- input/textarea/select öğelerinin `.value` değeri okunmaz; `value` attribute'u LLM'e gönderilmez.
- Analiz salt okunurdur: tıklama, form gönderme, klavye simülasyonu yok; `chrome.debugger` kullanılmaz.
- Vurgulama katmanı sayfanın davranışını değiştirmez (`pointer-events: none`, sayfa DOM'una kalıcı müdahale yok).
- Uzak kod yok: CDN script, `eval`, uzaktan import kullanılmaz. axe-core paketten gömülür.
- ÖLÇÜM SONUCU UYDURMA. Tutarlılık sapmaları, halüsinasyon oranları, manuel test tabloları, `reports/` altındaki JSON'lar, README'deki doğrulama sayıları ve yansıtma notu YALNIZCA öğrencinin gerçek çalıştırmalarından gelir. Sen bu verileri üreten araçları ve boş şablonları yazarsın; değer alanlarına `TODO: gerçek ölçüm` yazarsın.
- `docs/ai-gunlugu.md` ve yansıtma notunu öğrenci yazar. Bu dosyalara içerik ekleme.
- Push'u Claude yapar (`origin` = https://github.com/HakanKoco/UX-DOCTOR-CHROME.git, dal `master`). Commit'ten sonra push et. Push öncesi `npm run build`, tip kontrolü ve testler geçmeli; commit geçmişinde API anahtarı olmadığı taranmalı. Force push yapma.

## Gizlilik katmanı (LLM katmanından ÖNCE hazır olmalı)
- Hassas sayfa tespiti şu sinyallerden yapılır:
  - password alanı ya da `autocomplete="cc-*"` / `one-time-code` gibi alanlar,
  - hesap veya oturum metinleri ("Hesabım", "Çıkış Yap", "Profilim", "Randevularım" vb.),
  - hesap ve giriş sayfalarını işaret eden URL kalıpları.
- Tespit edilirse LLM gönderimi kilitlenir. Kullanıcı açık onay verirse gönderilir ve onay rapora kaydedilir.
- Her LLM gönderiminden önce bir onay ekranı açılır ve gönderilecek JSON'un tam önizlemesi gösterilir. Kullanıcı "Gönder" demeden istek atılmaz.
- Metin maskeleme: TC kimlik no (11 hane), telefon, e-posta, IBAN, kart numarası. Maskeleme ve hassas sayfa tespiti fonksiyonları Vitest ile birim testli olur.

## Deterministik katman
- axe-core, WCAG 2.2 AA etiketleriyle çalıştırılır (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa).
- Çekirdek kontroller: renk kontrastı, eksik alt metin, etiketsiz form alanı, 24x24 px altı dokunma hedefi, sayfa dili tanımı. Bunlara karşılık gelen axe kural adlarını dokümandan doğrula.
- axe'in `incomplete` sonuçları ihlal sayılmaz; "elle incelenmeli" başlığıyla ayrı listelenir.

## Yorumsal (LLM) katmanı
- DOM özeti numaralı bir öğe envanteridir. Her öğeye `E1, E2, ...` kimliği verilir ve şu bilgiler eklenir:
  - rol, erişilebilir ad veya görünür metin (maskelenmiş), etiket türü,
  - boyut ve konum, görünürlük, yazı boyutu, disabled/aria-* durumları,
  - benzersiz CSS seçici (tekilliği `querySelectorAll` ile doğrulanır).
- Envanter boyutu sınırlıdır: görünür etkileşimli öğeler, başlıklar ve landmark'lar. Kesilme olursa rapora yazılır.
- Norman'ın 6 ilkesinin her biri için 4-6 evet/hayır rubrik sorusu hazırlanır: Görünürlük, Geri Bildirim, Kısıtlar, Eşleme, Tutarlılık, Sağlarlık.
- LLM puan vermez. Her rubrik sorusu için cevap, kanıt öğe kimlikleri ve kısa gerekçe döndürür. Puanı kod hesaplar.
- Yanıt, şemayla zorlanmış yapılandırılmış JSON olur. Tutarlılığı artıran parametreleri (ör. temperature) dokümandan kontrol ederek kullan.
- Envanterde olmayan bir kimliğe atıf otomatik halüsinasyon sayılır: bulgudan düşülür ve sayılır.
- Statik analiz sınırı: Geri Bildirim ilkesi etkileşimsiz değerlendirilir (aria-live, yükleme göstergeleri, focus/hover stilleri). Bu durum README'de sınırlama olarak yazılır.

## Bulgu formatı
Her bulguda şu alanlar bulunur:
- `selector`; LLM bulgularında ek olarak `elementId`,
- `source`: `deterministic` | `llm`,
- `rule`: ör. "WCAG 1.4.3" veya "Norman: Geri Bildirim",
- `severity`: Kritik / Yüksek / Orta / Düşük,
- `description` ve somut `fix` önerisi,
- `evidence`: sayfada vurgulama ve isteğe bağlı kırpılmış ekran görüntüsü. Görüntü yalnızca yerelde kalır, LLM'e gitmez.

## Skorlama
- Her kategori ve ilke için 0-100 alt skor ile ağırlıklı toplam skor hesaplanır. Deterministik ve LLM skorları ayrı gösterilir.
- Formül `src/scoring/` altında saf fonksiyonlar olarak yazılır ve birim testlidir. Ağırlıklar tek bir yapılandırma dosyasında durur.
- README'de formül ve gerekçesi açıkça yazılır.

## Doğrulama araçları (ödevin %25'i)
- Tutarlılık: yan panelde "aynı sayfayı N kez analiz et" (N ≥ 3) işlevi bulunur.
  - Her çalıştırmada ham LLM yanıtı, prompt sürümü, model adı ve zaman damgası kaydedilir.
  - İlke başına ortalama, standart sapma ve min-max değerleri JSON olarak dışa aktarılır.
- Halüsinasyon iki aşamada kontrol edilir: otomatik kontrol (kimlik ve seçici sayfada var mı) ve elle doğrulama için dışa aktarım. Dışa aktarımda her LLM bulgusunun "gerçek mi?" alanı boş bırakılır.
- `docs/` altında boş şablonlar oluşturulur: manuel karşılaştırma tablosu (yakalanan / kaçırılan / yanlış alarm), Büyükanne Testi ve Gece 3 Acil Durum Testi.

## Kod ve repo düzeni
- Klasörler: `src/background`, `src/content`, `src/sidepanel`, `src/options`, `src/shared` (tipler, maskeleme, rapor şeması), `src/scoring`, `reports/`, `docs/`.
- Rapor JSON şeması `src/shared` içinde tek kaynaktan tanımlanır.
- Her commit öncesi `npm run build`, `npx tsc --noEmit` ve testler hatasız geçer.
- Commit'ler küçük ve anlamlı olur. Mesajlar Türkçe ve Conventional Commits önekli: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Fazlar
0. İskeleti incele. Manifest'i yan panel, ayarlar sayfası ve service worker ile en az izinle düzenle. docs/GEREKSINIMLER.md'yi oluştur.
1. Yan panel ve ayarlar sayfası (anahtar girişi, model seçimi).
2. Deterministik katman, vurgulama ve seçici üretimi.
3. Gizlilik katmanı (tespit, maskeleme, onay ekranı) ve testleri.
4. LLM katmanı (envanter, rubrik prompt, şema, kimlik doğrulama, çalıştırma kaydı).
5. Skorlama, rapor görünümü ve JSON dışa aktarma.
6. Doğrulama araçları ve şablonlar.
7. README: kurulum, skor formülü, Mermaid mimari şeması, bilinen sınırlamalar, doğrulama bölümü iskeleti.

Kapsam: Faz 7 bitmeden ek özellik önerme.