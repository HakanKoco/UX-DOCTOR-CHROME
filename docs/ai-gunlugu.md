# AI Günlüğü

Biçim: tarih · ne istedim · ne çıktı · neyi kabul ettim / değiştirdim

- 03.10.2026 20:47 · Ödevin tamamını verip eklenti mimarisi istedim · Önce statik bir denetçi önerildi, ben davranış ölçümü beklediğim için "çok sıradan" buldum · Ödev kapsamında kalmaya karar verdim (§8 kapsam uyarısı); ekran kaydını etik kuralı yüzünden reddettik.

- 04.10.2026 21:08 · Claude Code kurulumu · Kurulum "başarılı" dedi ama `claude` komutu bulunamadı. PATH'e ayrı bir değişken eklemişim, Path'in içine değil · Path'i düzenleyerek ve komutla düzelttim; `claude --version` ile doğruladım.

- 04.10.2026 22:43 · `.claude/settings.json` oluşturmak · Dosya klasör yerine tek bir `.claude` dosyası olarak oluşmuş, `git status` settings.json'ı göstermedi · Dosyayı klasörün içine taşıdım; commit işlemini daha sonra yapmaya bıraktım.

- 05.10.2026 20:35 · Gemini ile LLM katmanı · Gönderim 400 hatasıyla reddedilirdi: `mimeType` değeri yanlıştı (`application/json`, doğrusu `APPLICATION_JSON`). Hatayı Claude Code sahte anahtarla Google'ı yoklayarak buldu · Düzeltmeyi onayladım.

- 05.10.2026 22:27 · Sohbet asistanı anahtarın `AIza` ile başlayacağını söyledi · Anahtarım `AQ.` önekliydi; doğrulamadan söylenmişti. Teşhis kutusu anahtar biçimini gösterdi · Asistanın tahminini bir daha doğrulamadan kullanmadım.

- 06.10.2026 20:41 · LLM denemesi 503 ve 429 verdi · Claude Code kodu inceleyince tek analizde hiç yeniden deneme olmadığını fark etti · 6 denemeli bekleme ve 429 kota teşhisi eklettim.

- 06.10.2026 22:14 · Sohbet asistanı "3 site ve tutarlılık için 6-7 istek yeter, kota sorun olmaz" dedi · Gemini 3.8 Flash için günlük sınır 20'ymiş ve eski yeniden denemeler kotayı yemişti · Limit sayısını artık hata kutusundan okuyorum, tahmine güvenmiyorum.

- 07.10.2026 10:32 · Skorlar gerçek sitelerde 2-12'ye yığıldı, LLM skoru ise 88-100 çıktı · Claude Code kod incelemesiyle toplam skorun kategori skorlarının çarpımı gibi çalıştığını (üslerin toplamı 6) buldu · Formül değişikliği skor-v3 olarak yapıldı; önce/sonra tabloları README'de.

- 07.10.2026 14:18 · Daha önce yaptığım `.claude/settings.json` düzenlemesini ve skor-v3 değişikliklerini Git'e aktarmak istedim · Değişiklikler kontrol edildi ve ilgili dosyaların commit için hazır olduğu görüldü · Commit işlemlerini bugün gerçekleştirdim.

- 07.10.2026 14:54 · Rapor dosyalarını Claude Code'a okutmak istedim · Dosyalar yoktu: skorları ekranda görmüştüm ama "Raporu JSON olarak indir"e basmamıştım · Raporları indirdim, ardından bir daha ölçüm almadan önce indirme adımını kontrol ediyorum.
