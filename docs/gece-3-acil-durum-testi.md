# Gece 3 Acil Durum Testi (Ödev 4.d)

> Bu şablonu öğrenci doldurur. Değerler yalnızca gerçek denemeden gelir. "Sayfada sorun var mı?" sütunu öğrencinin
> gözlemidir; "Araç yakaladı mı?" sütunu `reports/saglik-acibadem.json` raporundan alınmıştır. Kesin gözlem olmayan
> maddeler "kontrol edilmedi" olarak bırakılmıştır.

## Senaryo

Gece saat 3'te, uykulu ve stresli bir kullanıcı, telefonundan, loş ışıkta ve tek elle, sağlık sitesinde acil bir
bilgiye ulaşmaya çalışıyor (ör. acil servis telefonu ve adresi, nöbetçi eczane, en yakın hastane). Her saniye önemli;
okumaya ve keşfetmeye sabrı yok.

| Alan | Değer |
|---|---|
| Sağlık sitesi ve sayfa (yalnızca herkese açık) | Acıbadem Sağlık Grubu, ana sayfa — https://www.acibadem.com.tr/ |
| Aranan acil bilgi | Acil servis telefon numarası |
| Cihaz / ekran genişliği | Chrome DevTools cihaz görünümü, iPhone 12 Pro (390 px); ekran parlaklığı kısık |
| Bilgiye ulaşma süresi ve tıklama sayısı | Yaklaşık 40 sn, 3 tıklama; numaraya ulaşıldı |
| Tarih | 2026-10-07 |
| Karşılaştırılan rapor (`reports/…json`) | `reports/saglik-acibadem.json` (analiz masaüstü genişliğinde, 1078 px; mobil genişlikte ayrı analiz yapılmadı) |

## Kontrol listesi

| # | Kontrol | Sayfada sorun var mı? | Araç yakaladı mı? (Evet / Hayır / Uygulanamaz) | İlgili bulgu (kimlik, kural) | Not |
|---|---|---|---|---|---|
| 1 | Acil telefon numarası ilk ekranda, aramadan görünüyor mu? | Var: numara ilk ekranda değil; aşağı kaydırıp ilgili bölümü bulmak gerekti | Hayır | — | Rubrikte acil iletişim bilgisi sorusu yok; analiz masaüstü genişliğinde yapıldı, mobil ilk ekran ölçülmedi |
| 2 | Numara tek dokunuşla aranabilir mi (`tel:` bağlantısı, yeterli dokunma alanı)? | Kontrol edilmedi | Hayır | — | `tel:` bağlantısı rubrikte ve axe kurallarında yok |
| 3 | Loş ışıkta okunabilir mi (kontrast, yazı boyutu)? | Var: parlaklık kısıkken açık renkli yazılar daha zor okunuyor | Evet | `color-contrast` (WCAG 1.4.3), 12 öğe | Gözlemle uyumlu |
| 4 | Acil bilgiye giden yol adı açık mı ("Acil", "Nöbetçi eczane" gibi; belirsiz menü adı yok)? | Var: acil bilgiye giden bölümün adı ilk bakışta açık değil; "Acil" ifadesi daha belirgin olmalı | Hayır | LLM M2: "evet" (bağlantı metinleri hedeflerini anlatıyor; E72, E85) | Araç ile gözlem çelişiyor: rubrik belirsiz metni ("tıklayın", "devamı") arar, acil bilgi yolunun belirginliğini sormaz |
| 5 | Çerez/kampanya açılır penceresi acil bilgiyi örtüyor mu? | Kontrol edilmedi | Uygulanamaz | — | Açılır pencere davranışı statik analizde görülmez |
| 6 | Sayfa yüklenirken ya da arama yaparken durum geri bildirimi var mı? | Kontrol edilmedi | Uygulanamaz | LLM F1: "evet" (E56, `role="alert"` / `aria-live` bölgesi) | Araç yalnızca statik ipucunu gördü; yükleme davranışı etkileşimsiz doğrulanamaz |
| 7 | Adres/harita bilgisi metin olarak da var mı (yalnızca görsel değil)? | Yok: adres iletişim bilgilerinde metin olarak var | Uygulanamaz (sorun yok) | — | — |

## Sonuç

- Aracın yakaladığı kritik sorun(lar): Düşük kontrastlı metinler (`color-contrast`, 12 öğe); loş ışıkta okunabilirliği
  düşüren sorunla örtüşüyor. Rapordaki `meta-viewport` bulgusu (sayfa yakınlaştırmayı engelliyor, WCAG 1.4.4) mobil
  kullanım için ilgili, ancak bu denemede ayrıca gözlemlenmedi.
- Aracın kaçırdığı kritik sorun(lar): Acil servis numarasının mobil ilk ekranda olmaması (yaklaşık 40 sn ve 3
  tıklama gerekti) ve acil bilgiye giden yolun adının belirgin olmaması.
- Kaçırmanın nedeni: Rubrikte acil iletişim bilgisinin görünürlüğüne dair soru yok; analiz tek bir masaüstü pencere
  genişliğinde yapıldığı için mobil ilk ekran ölçülmedi; açılır pencere ve yükleme davranışı statik analizle
  görülemez.
