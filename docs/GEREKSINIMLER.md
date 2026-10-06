# Gereksinim İzlenebilirlik Tablosu

Kaynak: [docs/ODEV.md](ODEV.md). Ek kurallar: [CLAUDE.md](../CLAUDE.md). Bu dosya her fazda güncellenir.

Durum değerleri:
- **Bekliyor**: henüz yapılmadı.
- **Tamamlandı**: kodda karşılandı.
- **Sürekli kural**: tek seferlik iş değil, her fazda uyulur.
- **Öğrenci**: öğrencinin kendisinin yapacağı iş (gerçek ölçüm, manuel test, video, yansıtma notu). Bu değerler araç tarafından üretilmez, uydurulmaz.

## Gereksinimler

| ID | Gereksinim | Ödev bölümü | Faz | Dosya/klasör | Durum |
|---|---|---|---|---|---|
| R01 | Chrome Extension, Manifest V3 | 2 | 0 | manifest.config.ts | Tamamlandı |
| R02 | Deterministik katman: axe-core ile WCAG 2.2 AA | 2.a | 2 | src/content | Tamamlandı |
| R03 | Kontrast oranı kontrolü | 2.a | 2 | src/content | Tamamlandı (color-contrast) |
| R04 | Eksik alt metin kontrolü | 2.a | 2 | src/content | Tamamlandı (image-alt, input-image-alt, role-img-alt, svg-img-alt, area-alt, object-alt) |
| R05 | Etiketsiz form alanı kontrolü | 2.a | 2 | src/content | Tamamlandı (label, select-name, aria-input-field-name, aria-toggle-field-name) |
| R06 | 24x24 px altı dokunma hedefi kontrolü | 2.a | 2 | src/content | Tamamlandı (target-size, açıkça etkinleştirildi) |
| R07 | Sayfa dili tanımı kontrolü | 2.a | 2 | src/content | Tamamlandı (html-has-lang, html-lang-valid, valid-lang, html-xml-lang-mismatch) |
| R08 | Yorumsal katman: LLM ile Norman'ın 6 ilkesi (rubrik) | 2.b | 4 | src/background, src/shared | Tamamlandı (6 ilke × 4-5 soru, yapılandırılmış JSON, puanı kod hesaplar; sağlayıcı Claude API ya da Gemini API) |
| R09 | Her ilke/kategori için 0-100 alt skor | 2 (Skorlama) | 5 | src/scoring | Tamamlandı (skor-v3: kategori alt skoru 100·e^(−D_c/25); LLM ilkesi 3'ten az yanıtla "yetersiz kapsam"; src/scoring/score.ts) |
| R10 | Ağırlıklı toplam skor | 2 (Skorlama) | 5 | src/scoring | Tamamlandı (skor-v3 deterministik: ½ · kategori skorlarının ağırlıklı geometrik ortalaması + ½ · 100·e^(−R/20), sayfa büyüklüğünden bağımsız; toplam 0.6 deterministik + 0.4 LLM; ağırlıklar ve sabitler src/scoring/weights.ts) |
| R11 | Skor formülü ve gerekçesi README'de | 2 (Skorlama), 6 | 7 | README.md | Tamamlandı (README: formül, 3 cümlelik gerekçe, altı gerçek raporla eski/yeni tablo, seçenek karşılaştırması, ½/½ duyarlılığı) |
| R12 | Deterministik ve LLM skorları ayrı gösterilir | 2 (Skorlama) | 5 | src/sidepanel | Tamamlandı (yan panelin üstünde iki ayrı skor kartı + JSON'da ayrı alanlar) |
| R13 | Bulguda ilgili DOM öğesi (CSS seçici) | 2 (Bulgu) | 2 / 4 | src/content, src/shared | Tamamlandı (deterministik + LLM elementId/selector; Chrome çevirisinin <font> sarmalayıcıları seçiciye girmez) |
| R14 | Bulguda sayfada vurgulama veya ekran görüntüsü | 2 (Bulgu) | 2 / 5 | src/content | Tamamlandı (vurgulama + isteğe bağlı kırpılmış ekran görüntüsü, yalnızca yerel) |
| R15 | Bulguda ihlal edilen kural/ilke | 2 (Bulgu) | 2 / 4 | src/shared | Tamamlandı |
| R16 | Bulguda şiddet: Kritik / Yüksek / Orta / Düşük | 2 (Bulgu) | 2 / 4 | src/shared | Tamamlandı (LLM'de şiddet rubrikte sabit) |
| R17 | Bulguda somut düzeltme önerisi | 2 (Bulgu) | 2 / 4 | src/shared | Tamamlandı (src/shared/axeTemplates.ts: 70 kuralın Türkçe başlığı, 45+ kurala öğeye özel şablon; LLM bulgusunda envanter kimlikli Türkçe metin) |
| R18 | Rapor eklenti panelinde görüntülenir | 2 (Rapor) | 5 | src/sidepanel | Tamamlandı ("En önemli 3 sorun", kapalı ve sayı rozetli gruplar) |
| R19 | Rapor JSON olarak dışa aktarılır | 2 (Rapor) | 5 | src/shared, src/sidepanel | Tamamlandı (src/shared/report.ts şeması, Blob indirme) |
| R20 | En az 3 sitede test (sağlık, Türk e-ticaret, kamu; yalnızca herkese açık sayfalar) | 3 | — | reports/ | Öğrenci |
| R21 | Tutarlılık testi aracı: aynı sayfayı N ≥ 3 kez analiz, ilke başına ortalama / std / min-max dışa aktarımı | 4.a | 6 | src/sidepanel, src/shared | Tamamlandı (N=3-10, ilke başına ort./std/min-max, soru uyumu, JSON; scripts/tutarlilik-tablosu.mjs; Gemini'de çalıştırmalar arası 15 sn bekleme; 429/503/529'da geri sayımlı en çok 6 yeniden deneme: src/shared/retry.ts; ilerleme chrome.storage.local'de, kaldığı yerden devam: src/shared/consistencyProgress.ts) |
| R22 | Tutarlılık ölçümünün yapılması; sapma > 10 puansa neden ve çözüm açıklaması | 4.a | — | README.md, reports/ | Öğrenci |
| R23 | Manuel karşılaştırma tablosu şablonu (yakalanan / kaçırılan / yanlış alarm) | 4.b | 6 | docs/ | Şablon tamamlandı: docs/manuel-karsilastirma.md (doldurma: Öğrenci) |
| R24 | Manuel denetim (klavye + ekran okuyucu, en az 1 görev) ve tablonun doldurulması | 4.b | — | docs/ | Öğrenci |
| R25 | Halüsinasyon kontrolü: otomatik kimlik/seçici doğrulama + elle doğrulama için dışa aktarım | 4.c | 4 / 6 | src/background, src/shared | Tamamlandı (otomatik: kimlik + seçici; elle: gercekMi boş dışa aktarım; scripts/halusinasyon-orani.mjs; bozuk/şemadışı yanıtlarda ham yanıt kaydı korunur) |
| R26 | Halüsinasyon oranının elle doğrulanması ve raporlanması | 4.c | — | README.md | Öğrenci |
| R27 | "Büyükanne Testi" ve "Gece 3 Acil Durum Testi" şablonları | 4.d | 6 | docs/ | Şablonlar tamamlandı: docs/buyukanne-testi.md, docs/gece-3-acil-durum-testi.md (doldurma: Öğrenci) |
| R28 | Bu iki testin sağlık sitesinde yapılıp sonuçlarının yazılması | 4.d | — | docs/ | Öğrenci |
| R29 | Giriş yapılmış / kişisel / sağlık verili sayfada LLM gönderim kilidi ve açık onay | 5 | 3 | src/shared, src/sidepanel | Tamamlandı (üç durumlu karar: hassas değil / belirsiz / hassas; belirsiz de kilitler; onay ve zaman damgası report.privacy alanında) |
| R30 | Form değerleri, klavye vuruşları, kişisel veri toplanmaz; LLM'e giden içerik maskelenir | 5 | 3 / 4 | src/shared | Tamamlandı (envanterde .value/value attribute/textarea/contenteditable okunmaz; tüm metinler maskelenir) |
| R31 | API anahtarı koda gömülmez, repoya commit edilmez (ayarlar sayfasından girilir, chrome.storage.local) | 5 | 1 | src/options, src/shared/settings.ts | Tamamlandı (sürekli kural; Claude ve Gemini anahtarları ayrı alanlarda) |
| R32 | Analiz edilen siteye otomatik form gönderimi / tıklama yok | 5 | 2 / 4 | src/content | Tamamlandı (sürekli kural: analiz betiği salt okunur) |
| R33 | GitHub repo, anlamlı commit geçmişi (tek commit kabul edilmez) | 6 | Tümü | git | Sürekli kural (commit'ler küçük ve Conventional Commits; push: öğrenci, origin/master; Claude yalnızca commit atar) |
| R34 | README: kurulum adımları | 6 | 7 | README.md | Tamamlandı |
| R35 | README: mimari şema | 6 | 7 | README.md | Tamamlandı (Mermaid) |
| R36 | README: doğrulama sonuçları bölümü iskeleti | 6 | 7 | README.md | Tamamlandı (değerler ölçüm yer tutucusu olarak boş) |
| R37 | README: doğrulama sonuçlarının gerçek değerleri | 6 | — | README.md | Öğrenci |
| R38 | README: bilinen sınırlamalar | 6 | 7 | README.md | Tamamlandı |
| R39 | 3 sitenin JSON raporları `/reports` klasöründe | 6 | — | reports/ | Öğrenci |
| R40 | 3-5 dakikalık demo videosu | 6 | — | — | Öğrenci |
| R41 | Yansıtma notu (yarım sayfa) | 6 | — | — | Öğrenci |
| R42 | AI günlüğü | (CLAUDE.md) | — | docs/ai-gunlugu.md | Öğrenci |
| R43 | Kapsam: önce 5-6 deterministik kontrol + Norman ilkeleri; ek özellik doğrulamadan sonra | 8 | Tümü | — | Sürekli kural (5 çekirdek kontrol + Norman; ek özellik eklenmedi) |
| R44 | LLM sağlayıcısı seçimi: Claude API ya da Gemini API (ücretsiz katman, Flash); ayrı anahtar alanı, aynı gizlilik/onay/doğrulama kuralları, çalıştırma kaydında sağlayıcı ve model | 2.b, 5 (CLAUDE.md) | 4 (ek) | src/background/geminiClient.ts, src/shared/llmRequest.ts, src/shared/geminiResponse.ts, src/options | Tamamlandı (gemini-3.8-flash varsayılan; temperature 1.0, thinkingLevel MEDIUM; onay ekranında ücretsiz katman veri uyarısı) |
| R45 | Gemini hata teşhisi: HTTP durumu, Google status/reason/message, uç nokta yolu, model; anahtar asla gösterilmez; anahtar kırpma; mimeType APPLICATION_JSON | 2.b, 5 | ek | src/shared/geminiResponse.ts, src/shared/DiagnosticsDetails.tsx, src/shared/settings.ts | Tamamlandı |
| R46 | Anahtar durum mesajı daima seçili sağlayıcıya göre | (CLAUDE.md) | ek | src/shared/settings.ts (keyStatus) | Tamamlandı |
| R47 | Tarayıcı testleri (yeni bağımlılık yok; başsız Chrome + CDP yalnızca test aracında) | 4 (doğrulama altyapısı) | ek | tests/browser, vitest.browser.config.ts | Tamamlandı (npm run test:browser) |
| R48 | Bilinen hatalarla dolu test sayfası ve beklenen sonuç listesi | 4.b (altyapı) | ek | tests/fixtures/bilinen-hatalar.html, tests/fixtures/beklenen.json | Tamamlandı (7 kasıtlı hata yakalanıyor, 5 kontrol öğesinde yanlış alarm yok; manuel tablo öğrencide) |
| R49 | Sayfa çevirisi tespiti ve raporda not | (tekrarlanabilirlik) | ek | src/shared/translation.ts, src/content/selector.ts | Tamamlandı (sezgisel; resmi doküman bulunamadı) |
| R50 | 429 kota teşhisi (RPM/TPM/RPD), RetryInfo'ya uyan yeniden deneme, günlük kotada durma, düşünme token sayısı | 2.b (çalışabilirlik) | ek | src/shared/geminiResponse.ts, src/shared/retry.ts | Tamamlandı (quota.test.ts; kota türü quotaId kalıbından sezgisel, Gemini dokümanı adları yayımlamıyor) |
| R51 | Sayfa yüklenmeden analiz engeli, rapora page.loadState | 2 (tekrarlanabilirlik) | ek | src/shared/loadState.ts, src/content/analyzer.ts | Tamamlandı (loadState.test.ts, known-errors.test.ts) |
| R52 | Üçüncü taraf çerez/onay bileşeni etiketi (skoru etkilemez) | 4.b (altyapı) | ek | src/shared/thirdParty.ts | Tamamlandı (third-party.test.ts) |
| R53 | İstek boyutu küçültme seçimi; skor ayrım gücü alternatifleri ve LLM skorundaki belirsiz cevap sorunları | 2.b, 2 (Skorlama) | ek | — | Karar bekliyor (öğrenci; skor alternatifleri için rapor JSON'ları gerekli) |

## Teslim öncesi denetim (ODEV.md madde madde)

Tarih: 2026-10-04. Bu tablodaki her kanıt bu turda gerçekten açılıp çalıştırıldı:
`npm run build` (çıkış 0), `npx tsc --noEmit -p tsconfig.app.json` (çıkış 0), `npm test` (16 dosya, 212 test geçti),
`npm run test:browser` (3 dosya, 20 test geçti). Test adları dosyadaki `describe` / `it` metinleridir.

Durum: **Tamam** (kod + otomatik kanıt), **Kısmi** (kod var ama zayıf ya da yalnızca elle doğrulanabilir; ne eksik
olduğu yazılı), **Eksik**, **Öğrenci işi** (gerçek ölçüm/gözlem; değer burada yazılmaz).

| Ödev | Gereksinim | Kanıt | Durum |
|---|---|---|---|
| 2 | Chrome Extension, Manifest V3 | `manifest.config.ts` (`manifest_version: 3`); `npm run build` → `dist/manifest.json` | Tamam |
| 2.a | axe-core ile WCAG 2.2 AA | `src/content/axeRunner.ts` (`runOnly` etiketleri); `tests/browser/known-errors.test.ts` "bilinen-hatalar.html" | Tamam |
| 2.a | Kontrast, alt metin, etiketsiz alan, 24x24 hedef, sayfa dili | `src/shared/axeMapping.ts`; `axeMapping.test.ts` "çekirdek kuralları kategorilere eşler"; `known-errors.test.ts` 7 kasıtlı hata yakalanır, 5 kontrol öğesinde yanlış alarm yok | Tamam |
| 2.a | `incomplete` ihlal sayılmaz, ayrı listelenir | `axeRunner.ts` (`results.incomplete` → `manualReview`); `src/sidepanel/ManualReviewList.tsx` | Tamam (otomatik testi yok; elle görülür) |
| 2.b | LLM ile Norman'ın 6 ilkesi | `src/shared/rubric.ts`; `llm.test.ts` "rubrik her ilke için 4-6 soru içerir", "yapılandırılmış çıktı şeması gönderilir" | Tamam |
| 2.b | Envanterde olmayan kimlik halüsinasyon sayılır | `src/shared/llmValidate.ts`; `llm.test.ts` "envanterde olmayan kimlik halüsinasyon sayılır ve kanıttan düşülür"; `llmRobustness.test.ts` | Tamam |
| 2.b | LLM çağrısının gerçek koşulda tamamlanması | Gemini ücretsiz katmanında sürekli 503: tek analizde yeniden deneme yoktu (`src/sidepanel/App.tsx` `sendLlm` → `callLlm`), tutarlılık testinde 4 deneme vardı ve ilerleme yalnızca bellekteydi → Bu turda: tek analizde de geri sayımlı 6 deneme, Durdur düğmesi, elle onaylı "Flash-Lite ile dene" (`retry.test.ts`, `consistencyProgress.test.ts`). Google kaynaklı 503 kod ile çözülemez; gerçek çağrının tamamlanması öğrencinin denemesine bağlı | Tamam (kod) / Öğrenci işi (gerçek çağrı) |
| 2 Skor | Her ilke/kategori için 0-100 alt skor | `src/scoring/score.ts`; `score.test.ts` "(d) çok sayıda Kritik ihlalde bile 0-100 aralığında kalır…" | Tamam |
| 2 Skor | Ağırlıklı toplam skor | `src/scoring/weights.ts`; `score.test.ts` "Toplam = 0.6 × deterministik + 0.4 × LLM" | Tamam |
| 2 Skor | Formül README'de ve gerekçeli | README "Skor formülü ve gerekçesi" | Tamam (gerçek sitelerde kalibrasyonu bu turda madde 4'te ölçülüyor) |
| 2 Skor | Deterministik ve LLM skorları ayrı | `src/sidepanel/ScoreSummary.tsx`; rapor `scores.deterministic` / `scores.llm` | Tamam |
| 2 Bulgu | CSS seçici | `src/content/selector.ts`; `selector.test.ts` "tüm bulgu seçicileri sayfada tek öğe bulur…" | Tamam |
| 2 Bulgu | Vurgulama ya da ekran görüntüsü | `src/content/highlight.ts` (`pointer-events:none`, kapalı shadow DOM, temizlenir); `src/sidepanel/screenshot.ts` | Tamam (otomatik testi yok; elle görülür) |
| 2 Bulgu | Kural/ilke, şiddet, somut düzeltme | `src/shared/axeTemplates.ts`; `axeTemplates.test.ts` "eklentinin çalıştırdığı her kural için öneri boş değil, Türkçe…"; `known-errors.test.ts` (fix > 20 karakter, Türkçe) | Tamam |
| 2 Rapor | Panelde görüntülenir | `src/sidepanel/App.tsx`, `FindingList.tsx`, `TopIssues.tsx` ; kendi arayüzümüz: `tests/browser/own-ui-a11y.test.ts` (yan panel ve ayarlar, açık/koyu tema: axe ihlali yok, metin ≥ 13 px, Tab ile odak çerçevesi) | Tamam (bulgu listesi ve onay ekranı otomatik taranmıyor; elle) |
| 2 Rapor | JSON dışa aktarma | `src/shared/reportBuilder.ts`; `reportBuilder.test.ts` "LLM olmadan rapor kurar…"; `src/sidepanel/download.ts` ; çalışma zamanı şeması `validateReport` (`src/shared/report.ts`), `reportBuilder.test.ts` "buildReport çıktısı … şemadan geçer"; `npm run teslim-kontrol` | Tamam |
| 3 | 3 site (sağlık, Türk e-ticaret, kamu) | `reports/` içinde yalnızca `README.md` var | Öğrenci işi |
| 4.a | Tutarlılık aracı (N ≥ 3, ort./std/min-max, JSON) | `src/shared/validationExports.ts`, `src/scoring/stats.ts`; `validationExports.test.ts` "ilke başına istatistik, eşik ve soru uyumu üretir"; `scripts/tutarlilik-tablosu.mjs` ; ilerleme kaydı ve devam: `consistencyProgress.test.ts` "503 ile duraklatılan test biten çalıştırmaları korur ve kaldığı yerden sürer" | Tamam |
| 4.a | Tutarlılık ölçümü ve > 10 puan açıklaması | — | Öğrenci işi |
| 4.b | Manuel karşılaştırma şablonu | `docs/manuel-karsilastirma.md`; altyapı: `tests/fixtures/bilinen-hatalar.html`, `beklenen.json` | Tamam (şablon) |
| 4.b | Klavye + ekran okuyucu denetimi ve tablo | — | Öğrenci işi |
| 4.c | Otomatik halüsinasyon kontrolü + elle doğrulama dışa aktarımı | `llmValidate.ts`; `src/sidepanel/llmClient.ts` (`checkSelectors`); `validationExports.test.ts` "her LLM bulgusu için "gerçek mi?" alanı boş bırakılır"; `scripts/halusinasyon-orani.mjs` | Tamam |
| 4.c | Halüsinasyon oranının ölçülmesi | — | Öğrenci işi |
| 4.d | Büyükanne ve Gece 3 şablonları | `docs/buyukanne-testi.md`, `docs/gece-3-acil-durum-testi.md` | Tamam (şablon) |
| 4.d | İki testin sağlık sitesinde yapılması | — | Öğrenci işi |
| 5 | Hassas sayfada çalışmama ya da açık onay | `src/shared/sensitivity.ts`; `sensitivity.test.ts` (üç durumlu karar, `isLocked`); `privacy.test.ts`; kilit `App.tsx` `llmLocked`; onay `reportBuilder.test.ts` "hassas sayfa onayı rapora yazılır" | Tamam (panel düzeyindeki kilidin otomatik testi yok; elle görülür) |
| 5 | Her gönderimden önce tam JSON önizlemeli onay ekranı | `ConfirmSendDialog.tsx`; `sendLlm` yalnızca bu ekranın "Gönder" düğmesinden çağrılır | Tamam (otomatik testi yok; elle görülür) |
| 5 | Form değerleri ve kişisel veri LLM'e gitmez, maskelenir | `src/shared/masking.ts`; `masking.test.ts`; `llm.test.ts` "kullanıcı mesajındaki envanter maskelenmiştir…"; `axeMapping.test.ts` "value attribute değerlerini gizler"; `privacy.test.ts` "yazma alanının içeriği okunmaz…" ; `tests/browser/ethics.test.ts` (dolu-form.html: envanter, LLM gövdesi, bulgular, sinyallerde değer yok; kendi kodumuz `.value` okumaz). Bu turda bulunan ve düzeltilen açık: contenteditable metni kanıt HTML'ine giriyordu. Bilinen istisna: axe-core içeride `.value` okur, çıktıya sızmaz (README) | Tamam |
| 5 | Klavye vuruşları toplanmaz | Kodda klavye dinleyicisi yok (`highlight.ts`'te yalnızca scroll/resize) ; `ethics.test.ts` "analiz betiği klavye ya da girdi dinleyicisi eklemez" | Tamam |
| 5 | API anahtarı koda gömülmez, commit edilmez | `src/shared/settings.ts` (`chrome.storage.local`); `git grep` taramasında yalnızca test kodundaki sahte değerler (`TEST-ONLY`) ; `npm run teslim-kontrol`: çalışma ağacı ve tüm commit geçmişi taranır (sk-ant-, AIza, AQ.) | Tamam |
| 5 | Siteye otomatik form gönderimi / tıklama yok | `src/content/analyzer.ts` (salt okunur); manifest'te `debugger` yok | Tamam |
| 5 (CLAUDE.md) | Gemini ücretsiz katman veri uyarısı onay ekranında ve README'de | `ConfirmSendDialog.tsx:70`; README "Yorumsal (LLM) katman" ve "Gizlilik ve güvenlik" | Tamam |
| 6 | Anlamlı commit geçmişi | `git log`: 41 commit; önekler feat 11, fix 8, docs 8, chore 7, test 7 | Tamam |
| 6 | README: kurulum, skor formülü, mimari şema, sınırlamalar | README "Kurulum", "Skor formülü ve gerekçesi", "Mimari" (1 Mermaid bloğu), "Bilinen sınırlamalar" | Tamam |
| 6 | README: doğrulama sonuçları | README "Doğrulama (Ödev Bölüm 4)" iskeleti; 21 ölçüm yer tutucusu | Öğrenci işi |
| 6 | 3 sitenin JSON raporları `/reports`'ta | — | Öğrenci işi |
| 6 | Demo videosu | — | Öğrenci işi |
| 6 | Yansıtma notu | — | Öğrenci işi |
| 8 | Önce küçük ve çalışan sürüm; ek özellik yok | 5 çekirdek kontrol + Norman; bu turda yeni özellik yok | Tamam |

Denetimde zayıf bulunan ve bu turda ele alınan noktalar:
- LLM çağrısının 503'e dayanıksızlığı (madde 2),
- panelin kendi okunabilirlik kuralları (madde 3),
- rapor dosyalarının çalışma zamanında doğrulanmaması ve teslim taraması (madde 5),
- form değeri/klavye için tarayıcı düzeyinde kanıt; contenteditable sızıntısı düzeltildi (madde 6).

Satırlar düzeltmelerden sonra güncellendi. Açık kalanlar: onay ekranı, panel düzeyindeki hassas sayfa kilidi ve
vurgulamanın otomatik testi yok (elle denetlenir); kanıt ekran görüntüsü dolu form alanındaki görünür yazıyı
içerebilir (README "Gizlilik ve güvenlik").

## İzin yol haritası

İzinler yalnızca kullanıldıkları fazda manifest'e eklendi. Gerekçeler README "İzinler ve gerekçeleri" bölümünde.

| İzin | Faz | Durum | Gerekçe | Kaynak |
|---|---|---|---|---|
| `sidePanel` | 0 | Eklendi | Arayüz yan panelde; ikon tıklaması `setPanelBehavior` ile paneli açar | https://developer.chrome.com/docs/extensions/reference/api/sidePanel |
| `storage` | 1 | Eklendi | Sağlayıcı seçimi, API anahtarları (Claude ve Gemini, ayrı) ve model seçimi `chrome.storage.local` içinde | https://developer.chrome.com/docs/extensions/reference/api/storage |
| `activeTab` | 2 | Eklendi | Yalnızca kullanıcının ikona tıkladığı sekmeye geçici erişim; sayfadan ayrılınca düşer. Yan panelin ikonla açılmasının bu izni verip vermediği resmi dokümanda yazmıyor; vermezse aşağıdaki isteğe bağlı izin devreye girer | https://developer.chrome.com/docs/extensions/develop/concepts/activeTab |
| `scripting` | 2 | Eklendi | axe-core ve envanter betiğini yalnızca analiz istendiğinde enjekte etmek (`executeScript`); `activeTab` ile birlikte gerekir | aynı kaynak |
| `optional_host_permissions: http://*/*, https://*/*` | 2 | Eklendi (kurulumda istenmez) | activeTab yetmezse kullanıcı yan paneldeki "Site erişim izni ver" düğmesiyle açıkça verir; ayarlar sayfasından geri alınabilir | https://developer.chrome.com/docs/extensions/reference/api/permissions |
| `host_permissions: https://api.anthropic.com/*` | 1 | Eklendi | Service worker'ın Claude API isteklerinin CORS nedeniyle engellenmemesi için yalnızca API alan adı. SDK ayrıca `anthropic-dangerous-direct-browser-access: true` başlığını gönderir (`dangerouslyAllowBrowser`) | node_modules/@anthropic-ai/sdk/client.js; https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/ |
| `host_permissions: https://generativelanguage.googleapis.com/*` | 4 (ek) | Eklendi | Service worker'ın Gemini API isteklerinin (`generateContent`, anahtar doğrulamada `models.get`) CORS nedeniyle engellenmemesi için yalnızca API alan adı. Anahtar `x-goog-api-key` başlığında | https://ai.google.dev/api/generate-content; https://ai.google.dev/api/models |
| Ekran görüntüsü (opsiyonel) | 5 | Tamamlandı (ek izin yok) | `tabs.captureVisibleTab` `activeTab` (ya da `<all_urls>`) ile çalışır; isteğe bağlı http/https izni yerine geçmez, bu durumda vurgulama kullanılır | https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab |

Bilerek **kullanılmayan**: `content_scripts` (her sayfaya otomatik enjeksiyon yok), geniş `host_permissions`, `debugger`, `tabs`, `contentSettings`, `downloads` (dışa aktarma `<a download>` ile yapılır). Derleme sırasında CRXJS'in eklediği `web_accessible_resources` kaydı vite.config.ts içindeki eklentiyle silinir (sayfalar eklentiyi tespit edemesin).

## Karar: skor-v3 (2026-10-06)

Önceki not (2026-10-04): skor-v2 (k = 25), gerçek raporlar çıkana kadar korunacaktı; siteler 0-20 aralığına
yığılırsa k ya da toplama yöntemi yeniden değerlendirilecekti.

**Gözlem (öğrencinin gerçek raporları, 2026-10-06, `skor-v2`):** Deterministik skorlar samsun.edu.tr 74.5,
tr.wikipedia.org 41.3, saglik.org.tr 11.5, ankara.bel.tr 8.3, acibadem.com.tr 3.6, hepsiburada.com 2.7. LLM skorları
61.9-93.6. Dört site 2-12 aralığına yığıldı. Raporlar repoya kopyalanmadı; teslim edilecek `reports/` dosyaları
skor-v3 ile yeniden alınacak. MHRS raporu dışa aktarılmadı.

**Neden:** skor-v2 toplamı `100·e^(−Σ 6·ağırlık_c·D_c/25)`, kategori skorlarının üsleri toplamı 6 olan çarpımıdır.
Ayrıca cezanın büyük kısmı (saglik %62, hepsiburada %81) kuralların kendisinden değil, aynı kuralın öğe sayısından
(log₂ n) geliyordu.

**Karşılaştırılan seçenekler** (altı gerçek rapor ve test sayfaları; değerler aynı bulgulara uygulanan formüllerden):

| Seçenek | samsun | wikipedia | ankara | saglik | hepsiburada | acibadem | Tek Kritik | Sonuç |
|---|---|---|---|---|---|---|---|---|
| skor-v2, k = 25 | 74.5 | 41.3 | 8.3 | 11.5 | 2.7 | 3.6 | 82.5 | Yığılma |
| a) k = 50 | 86.3 | 64.3 | 28.9 | 33.9 | 16.3 | 18.9 | 90.8 | Yalnızca ölçek; sıralama aynı |
| a) k = 100 | 92.9 | 80.2 | 53.7 | 58.2 | 40.4 | 43.5 | 95.3 | Yalnızca ölçek; tek Kritik zayıf |
| Geometrik ortalama (≡ k = 150) | 95.2 | 86.3 | 66.1 | 69.7 | 54.6 | 57.4 | 96.9 | Tek Kritik −3: çok zayıf |
| b) Benzersiz kural + küçük log | 83.6 | 72.7 | 55.4 | 53.2 | 44.3 | 40.0 | 90.5 | Kategori ağırlığını yok sayar |
| c) Şiddet bantları | 69.6 | 52.2 | 36.4 | 34.5 | 27.0 | 23.6 | 70.0 | Tek Kritik sert; ortak tavan |
| d) ½ en kötü + ½ ortalama | 84.5 | 76.5 | 58.7 | 56.4 | 41.0 | 40.5 | 91.1 | Test sayfalarında sıralamayı bozar |
| H) 100/(1+D/35) | 82.6 | 61.3 | 36.0 | 39.3 | 27.9 | 29.6 | 87.9 | Yalnızca eğri; sıralama aynı |
| **G) ½ geometrik + ½ kural (seçildi)** | **84.6** | **73.5** | **57.9** | **55.2** | **49.8** | **46.2** | **89.4** | |
| G, 0,6/0,4 | 86.8 | 76.0 | 59.5 | 58.1 | 50.8 | 48.4 | 90.9 | +1-3 puan, sıralama aynı |

**Karar:** Öğrenci deterministik skorun sertliğinin düzeltilmesini istedi; Claude yukarıdaki tabloya dayanarak G'yi ½/½ oranıyla önerdi ve uyguladı (`FORMULA_VERSION = skor-v3`). LLM için öğrencinin onayladığı A2 (3'ten az
yanıtlı ilke "yetersiz kapsam", ortalamaya girmez) ve bilgi amaçlı katı skor (belirsize düşen "hayır"lar "hayır"
sayılır, resmi skora girmez). "Katmanlar çelişiyor" uyarısı eklenmedi. Kanıtsız "evet" asimetrisi yalnızca README
"Bilinen sınırlamalar"a yazıldı; prompt ve doğrulayıcı değişmedi. PROMPT_VERSION değişmedi.

**G'nin bilinen ödünleşimi:** Tek kuralda çok öğe (şablon hatası) hafif sayılır: tek Kritik kural 1 öğede 89.4,
1000 öğede 76.1; beş farklı Yüksek kural 69.3. README "Bilinen sınırlamalar"da yazılı.

**Değişiklikten sonra yeniden alınacaklar** (skor-v3 ile):
1. Üç site raporu (`reports/saglik-*`, `eticaret-*`, `kamu-*`).
2. Tutarlılık testi JSON'u (N ≥ 3) ve README tutarlılık tablosu (A2 ilke skorlarını değiştirir).
3. Halüsinasyon elle doğrulama listesi, son raporla aynı çalıştırmadan (runId).
4. Manuel karşılaştırma, Büyükanne ve Gece 3 belgelerindeki skor alıntıları (deterministik bulgular değişmez).
5. README doğrulama sayıları.

## Doğrulama notu (araç tarafı)

Araç, bu repoda olmayan bir uçtan uca test düzeniyle (Chrome for Testing + CDP; sahte API anahtarı, yakalanan ve
test verisiyle yanıtlanan API isteği) denenmiştir. Bu deneme gerçek ölçüm DEĞİLDİR ve hiçbir rapora/README değerine
girmez; yalnızca aracın çalıştığını (gönderilen gövde = onay ekranındaki gövde, form değeri sızmaması, hassas sayfa
kilidi, dışa aktarımlar) kontrol eder. Gerçek ölçümler öğrencinin çalıştırmalarından gelir.
