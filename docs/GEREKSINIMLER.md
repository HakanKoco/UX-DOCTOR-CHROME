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
| R02 | Deterministik katman: axe-core ile WCAG 2.2 AA | 2.a | 2 | src/content | Bekliyor |
| R03 | Kontrast oranı kontrolü | 2.a | 2 | src/content | Bekliyor |
| R04 | Eksik alt metin kontrolü | 2.a | 2 | src/content | Bekliyor |
| R05 | Etiketsiz form alanı kontrolü | 2.a | 2 | src/content | Bekliyor |
| R06 | 24x24 px altı dokunma hedefi kontrolü | 2.a | 2 | src/content | Bekliyor |
| R07 | Sayfa dili tanımı kontrolü | 2.a | 2 | src/content | Bekliyor |
| R08 | Yorumsal katman: LLM ile Norman'ın 6 ilkesi (rubrik) | 2.b | 4 | src/background, src/shared | Bekliyor |
| R09 | Her ilke/kategori için 0-100 alt skor | 2 (Skorlama) | 5 | src/scoring | Bekliyor |
| R10 | Ağırlıklı toplam skor | 2 (Skorlama) | 5 | src/scoring | Bekliyor |
| R11 | Skor formülü ve gerekçesi README'de | 2 (Skorlama), 6 | 7 | README.md | Bekliyor |
| R12 | Deterministik ve LLM skorları ayrı gösterilir | 2 (Skorlama) | 5 | src/sidepanel | Bekliyor |
| R13 | Bulguda ilgili DOM öğesi (CSS seçici) | 2 (Bulgu) | 2 / 4 | src/content, src/shared | Bekliyor |
| R14 | Bulguda sayfada vurgulama veya ekran görüntüsü | 2 (Bulgu) | 2 / 5 | src/content | Bekliyor |
| R15 | Bulguda ihlal edilen kural/ilke | 2 (Bulgu) | 2 / 4 | src/shared | Bekliyor |
| R16 | Bulguda şiddet: Kritik / Yüksek / Orta / Düşük | 2 (Bulgu) | 2 / 4 | src/shared | Bekliyor |
| R17 | Bulguda somut düzeltme önerisi | 2 (Bulgu) | 2 / 4 | src/shared | Bekliyor |
| R18 | Rapor eklenti panelinde görüntülenir | 2 (Rapor) | 5 | src/sidepanel | Bekliyor |
| R19 | Rapor JSON olarak dışa aktarılır | 2 (Rapor) | 5 | src/shared, src/sidepanel | Bekliyor |
| R20 | En az 3 sitede test (sağlık, Türk e-ticaret, kamu; yalnızca herkese açık sayfalar) | 3 | — | reports/ | Öğrenci |
| R21 | Tutarlılık testi aracı: aynı sayfayı N ≥ 3 kez analiz, ilke başına ortalama / std / min-max dışa aktarımı | 4.a | 6 | src/sidepanel, src/shared | Bekliyor |
| R22 | Tutarlılık ölçümünün yapılması; sapma > 10 puansa neden ve çözüm açıklaması | 4.a | — | README.md, reports/ | Öğrenci |
| R23 | Manuel karşılaştırma tablosu şablonu (yakalanan / kaçırılan / yanlış alarm) | 4.b | 6 | docs/ | Bekliyor |
| R24 | Manuel denetim (klavye + ekran okuyucu, en az 1 görev) ve tablonun doldurulması | 4.b | — | docs/ | Öğrenci |
| R25 | Halüsinasyon kontrolü: otomatik kimlik/seçici doğrulama + elle doğrulama için dışa aktarım | 4.c | 4 / 6 | src/background, src/shared | Bekliyor |
| R26 | Halüsinasyon oranının elle doğrulanması ve raporlanması | 4.c | — | README.md | Öğrenci |
| R27 | "Büyükanne Testi" ve "Gece 3 Acil Durum Testi" şablonları | 4.d | 6 | docs/ | Bekliyor |
| R28 | Bu iki testin sağlık sitesinde yapılıp sonuçlarının yazılması | 4.d | — | docs/ | Öğrenci |
| R29 | Giriş yapılmış / kişisel / sağlık verili sayfada LLM gönderim kilidi ve açık onay | 5 | 3 | src/shared, src/sidepanel | Bekliyor |
| R30 | Form değerleri, klavye vuruşları, kişisel veri toplanmaz; LLM'e giden içerik maskelenir | 5 | 3 / 4 | src/shared | Bekliyor |
| R31 | API anahtarı koda gömülmez, repoya commit edilmez | 5 | 1 | src/options | Sürekli kural |
| R32 | Analiz edilen siteye otomatik form gönderimi / tıklama yok | 5 | 2 / 4 | src/content | Sürekli kural |
| R33 | GitHub repo, anlamlı commit geçmişi (tek commit kabul edilmez) | 6 | Tümü | git | Sürekli kural (push: Öğrenci) |
| R34 | README: kurulum adımları | 6 | 7 | README.md | Bekliyor |
| R35 | README: mimari şema | 6 | 7 | README.md | Bekliyor |
| R36 | README: doğrulama sonuçları bölümü iskeleti | 6 | 7 | README.md | Bekliyor |
| R37 | README: doğrulama sonuçlarının gerçek değerleri | 6 | — | README.md | Öğrenci |
| R38 | README: bilinen sınırlamalar | 6 | 7 | README.md | Bekliyor |
| R39 | 3 sitenin JSON raporları `/reports` klasöründe | 6 | — | reports/ | Öğrenci |
| R40 | 3-5 dakikalık demo videosu | 6 | — | — | Öğrenci |
| R41 | Yansıtma notu (yarım sayfa) | 6 | — | — | Öğrenci |
| R42 | AI günlüğü | (CLAUDE.md) | — | docs/ai-gunlugu.md | Öğrenci |
| R43 | Kapsam: önce 5-6 deterministik kontrol + Norman ilkeleri; ek özellik doğrulamadan sonra | 8 | Tümü | — | Sürekli kural |

## İzin yol haritası

İzinler yalnızca kullanıldıkları fazda manifest'e eklenir. Gerekçeler README'ye de taşınacak (Faz 7).

| İzin | Faz | Durum | Gerekçe | Kaynak |
|---|---|---|---|---|
| `sidePanel` | 0 | Eklendi | Arayüz yan panelde; ikon tıklaması `setPanelBehavior` ile paneli açar | https://developer.chrome.com/docs/extensions/reference/api/sidePanel |
| `storage` | 1 | Bekliyor | API anahtarı ve model seçimi `chrome.storage.local` içinde | https://developer.chrome.com/docs/extensions/reference/api/storage |
| `activeTab` | 2 | Bekliyor | Yalnızca kullanıcının ikona tıkladığı sekmeye geçici erişim; sayfadan ayrılınca düşer. Yan panelin ikonla açılmasının bu izni verip vermediği dokümanda yazmıyor; Faz 2'de elle test edilecek | https://developer.chrome.com/docs/extensions/develop/concepts/activeTab |
| `scripting` | 2 | Bekliyor | axe-core ve envanter betiğini yalnızca analiz istendiğinde enjekte etmek (`executeScript`); `activeTab` ile birlikte gerekir | aynı kaynak |
| Claude API erişimi | 4 | Bekliyor | `host_permissions` gerekip gerekmediği (CORS ve tarayıcıdan doğrudan çağrı başlığı) Faz 4'te resmi dokümandan doğrulanacak | — |
| Ekran görüntüsü (opsiyonel) | 5 | Bekliyor | `tabs.captureVisibleTab` `activeTab` ile çalışır; ek izin gerekmez | https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab |

Bilerek **kullanılmayan**: `content_scripts` (her sayfaya otomatik enjeksiyon yok), `host_permissions` (Faz 4 kararı hariç), `debugger`, `tabs`, `contentSettings`.
