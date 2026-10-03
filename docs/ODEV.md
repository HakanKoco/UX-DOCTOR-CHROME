# Ödev Metni (değiştirilmeden alınmıştır)

## 1. AMAÇ
Açık olan web sayfasını analiz eden, UX eksikliklerini tespit edip skorlayan ve her bulguyu kanıtla gösteren bir Chrome eklentisi geliştireceksiniz. Hedef "AI'a sayfayı sorup puan almak" değildir. Hedef, tekrarlanabilir, doğrulanabilir ve gerekçeli bir tanı aracıdır. Kanıtı olmayan bulgu, bulgu sayılmaz.

## 2. TEKNİK GEREKSİNİMLER
- Chrome Extension, Manifest V3
- En az iki analiz katmanı:
  - a) Deterministik katman: Kod ile kesin ölçülen kontroller (ör. axe-core ile WCAG 2.2 AA ihlalleri, kontrast oranı, eksik alt metin, etiketsiz form alanı, 24x24 px altı dokunma hedefi, sayfa dili tanımı).
  - b) Yorumsal katman: LLM (Claude API vb.) ile Don Norman'ın 6 ilkesine göre değerlendirme (Görünürlük, Geri Bildirim, Kısıtlar, Eşleme, Tutarlılık, Sağlarlık/Affordance).
- Skorlama:
  - Her ilke/kategori için 0-100 alt skor ve ağırlıklı toplam skor
  - Skor formülü README'de açıkça yazılmalı ve gerekçelendirilmeli
  - Deterministik ve LLM kaynaklı skorlar ayrı gösterilmeli
- Her bulgu şunları içermeli:
  - İlgili DOM öğesi (CSS seçici)
  - Sayfada vurgulama (highlight) ya da ekran görüntüsü
  - İhlal edilen kural/ilke (ör. "WCAG 1.4.3" veya "Norman: Geri Bildirim")
  - Şiddet: Kritik / Yüksek / Orta / Düşük
  - Somut düzeltme önerisi
- Rapor: Eklenti panelinde görüntülenmeli ve JSON olarak dışa aktarılabilmeli.

## 3. TEST EDİLECEK SİTELER
Her kategoriden en az birer site, toplam en az 3 site:
- Sağlık (hastane sitesi, randevu sayfası, sağlık bilgi portalı – yalnızca herkese açık sayfalar)
- Türk e-ticaret sitesi
- Kamu hizmeti sitesi

## 4. DOĞRULAMA (EN ÖNEMLİ BÖLÜM)
Aracınızın doğru çalıştığını kanıtlamanız gerekiyor:
- a) Tutarlılık testi: Aynı sayfayı en az 3 kez analiz edin. LLM skorlarının sapmasını raporlayın. Sapma 10 puandan fazlaysa nedenini ve çözümünüzü açıklayın.
- b) Manuel karşılaştırma: Bir sayfayı elle (klavye + ekran okuyucu ile en az 1 görev) denetleyin. Aracın yakaladığı, kaçırdığı ve yanlış alarm verdiği bulguları tablo halinde listeleyin.
- c) Halüsinasyon kontrolü: LLM'in raporladığı her bulgunun sayfada gerçekten var olduğunu doğrulayın. Var olmayan öğeye işaret eden bulgu oranını raporlayın.
- d) "Büyükanne Testi" ve "Gece 3 Acil Durum Testi": Sağlık sitesi için bu iki senaryoda aracın hangi kritik sorunu yakaladığını ya da kaçırdığını yazın.

## 5. ETİK VE GÜVENLİK KURALLARI (İhlali notu sıfırlar)
- Eklenti giriş yapılmış, kişisel veya sağlık verisi içeren sayfalarda ÇALIŞMAMALI ya da bu sayfalarda veri göndermeden önce kullanıcıdan açık onay almalı.
- Form alanlarına girilen değerler, klavye vuruşları ve kişisel veriler toplanmamalı, LLM'e gönderilmemeli. LLM'e giden içerikte form değerleri maskelenmeli.
- API anahtarı koda gömülmemeli, repoya commit edilmemeli.
- Analiz edilen sitelere otomatik form gönderimi, tıklama botu vb. müdahale yapılmamalı.

## 6. TESLİM EDİLECEKLER
- GitHub repo linki (anlamlı commit geçmişi ile; tek commit kabul edilmez)
- README:
  - Kurulum adımları
  - Skor formülü ve gerekçesi
  - Mimari şema
  - Doğrulama sonuçları (Bölüm 4)
  - Bilinen sınırlamalar
- 3 sitenin JSON raporları (repoda /reports klasöründe)
- 3-5 dakikalık demo videosu
- Yansıtma notu (yarım sayfa): AI'ın size nerede yardım ettiği, nerede yanılttığı ve bunu nasıl fark ettiğiniz

## 7. DEĞERLENDİRME
- Çalışan eklenti ve deterministik katman ........ %20
- LLM katmanı ve kanıta dayalı bulgular .......... %20
- Skorlama modeli ve gerekçesi ................... %15
- Doğrulama (Bölüm 4) ............................ %25
- README, demo, rapor kalitesi ................... %10
- Yansıtma notu .................................. %10

Önemli: Doğrulama bölümü en yüksek ağırlığa sahip. Güzel arayüzlü ama doğrulanmamış bir araç, sade ama ölçülmüş bir araçtan düşük not alır.

## 8. KAPSAM UYARISI
Önce küçük ve çalışan bir sürüm yapın: 5-6 deterministik kontrol + Norman ilkeleri. Ek özellikleri ancak doğrulama bölümü tamamlandıktan sonra ekleyin.
