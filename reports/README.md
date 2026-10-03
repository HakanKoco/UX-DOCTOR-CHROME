# reports/

Bu klasördeki JSON dosyaları **yalnızca gerçek çalıştırmalardan** gelir (yan paneldeki dışa aktarma düğmeleri).
Elle düzenlenmez, uydurulmaz. Ödev en az 3 site istiyor: sağlık, Türk e-ticaret ve kamu hizmeti (yalnızca herkese
açık sayfalar).

## Önerilen dosya adları

| Dosya | Nereden gelir |
|---|---|
| `saglik-<site>.json` | "Raporu JSON olarak indir" (sağlık sitesi) |
| `eticaret-<site>.json` | "Raporu JSON olarak indir" (Türk e-ticaret sitesi) |
| `kamu-<site>.json` | "Raporu JSON olarak indir" (kamu hizmeti sitesi) |
| `tutarlilik-<site>.json` | "Tutarlılık sonuçlarını JSON olarak indir" (N ≥ 3) |
| `halusinasyon-<site>.json` | "Elle doğrulama listesini JSON olarak indir", `gercekMi` alanları elle doldurulmuş |

Dışa aktarılan dosyalar tarayıcının indirme klasörüne `ux-doktor-…json` adıyla iner; buraya kopyalayıp yeniden
adlandırın.

## Yardımcı betikler

```bash
# Tutarlılık dosyasından README'ye yapıştırılacak Markdown tablosu
node scripts/tutarlilik-tablosu.mjs reports/tutarlilik-<site>.json

# Elle doldurulmuş halüsinasyon listelerinden oran
node scripts/halusinasyon-orani.mjs reports/halusinasyon-*.json
```
