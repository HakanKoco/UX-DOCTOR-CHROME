// Don Norman'ın 6 tasarım ilkesi için evet/hayır rubriği.
// Her soru "evet" = ilkeye uygun olacak biçimde yazılmıştır. LLM puan VERMEZ: yalnızca cevap, kanıt öğe
// kimlikleri ve kısa gerekçe döndürür. "Hayır" cevabının şiddeti burada sabittir (LLM belirlemez);
// puanı src/scoring hesaplar.
import type { NormanPrincipleId, Severity } from './report'

/** Rubrik ya da prompt metni değiştiğinde artırılır; her çalıştırma kaydına yazılır. */
export const PROMPT_VERSION = 'norman-rubrik-v1'

export interface RubricQuestion {
  id: string
  principle: NormanPrincipleId
  question: string
  /** "hayir" cevabında bulgunun şiddeti. */
  severity: Severity
  /** Envanterde hangi alanlara bakılacağına dair ipucu (LLM'e gider). */
  hint: string
}

export const PRINCIPLE_LABELS: Record<NormanPrincipleId, string> = {
  visibility: 'Görünürlük',
  feedback: 'Geri Bildirim',
  constraints: 'Kısıtlar',
  mapping: 'Eşleme',
  consistency: 'Tutarlılık',
  affordance: 'Sağlarlık',
}

export const PRINCIPLE_IDS: readonly NormanPrincipleId[] = [
  'visibility',
  'feedback',
  'constraints',
  'mapping',
  'consistency',
  'affordance',
]

export const RUBRIC: readonly RubricQuestion[] = [
  // Görünürlük
  {
    id: 'V1',
    principle: 'visibility',
    question: 'Sayfanın amacı ilk ekranda görünür bir ana başlıkla (h1 ya da eşdeğeri) belirtilmiş mi?',
    severity: 'Yüksek',
    hint: 'kind=heading, headingLevel=1, aboveFold',
  },
  {
    id: 'V2',
    principle: 'visibility',
    question: 'Ana gezinme (navigation landmark ya da menü bağlantıları) ilk ekranda görünür ve öğelerin adları anlaşılır mı?',
    severity: 'Orta',
    hint: 'role=navigation, landmarkId, aboveFold, name',
  },
  {
    id: 'V3',
    principle: 'visibility',
    question: 'Sayfanın birincil eylemi (ör. randevu al, ara, sepete ekle, başvur) ilk ekranda görünür bir düğme ya da bağlantı olarak sunulmuş mu?',
    severity: 'Yüksek',
    hint: 'kind=interactive, aboveFold, name',
  },
  {
    id: 'V4',
    principle: 'visibility',
    question: 'Görünür etkileşimli öğelerin hepsinin görünür bir metni ya da erişilebilir adı var mı (adsız, yalnızca ikonlu öğe yok mu)?',
    severity: 'Yüksek',
    hint: 'nameSource=none olan etkileşimli öğeler; value-attribute-hidden adı VAR sayılır',
  },
  {
    id: 'V5',
    principle: 'visibility',
    question: 'Etkileşimli öğelerin ve başlıkların yazı boyutu okunabilir mi (12 px ve üzeri)?',
    severity: 'Orta',
    hint: 'fontSizePx',
  },
  // Geri Bildirim (statik analiz: etkileşim yapılmaz)
  {
    id: 'F1',
    principle: 'feedback',
    question: 'Sayfada durum ve sonuç mesajlarını duyurmak için bir canlı bölge (aria-live, role=status ya da role=alert) var mı?',
    severity: 'Orta',
    hint: 'kind=status, page.counts.liveRegions',
  },
  {
    id: 'F2',
    principle: 'feedback',
    question: 'Formlardaki zorunlu alanlar programatik olarak işaretlenmiş mi (required ya da aria-required)?',
    severity: 'Orta',
    hint: 'states.required, states.aria-required; form alanı yoksa belirsiz',
  },
  {
    id: 'F3',
    principle: 'feedback',
    question: 'Form hatalarını iletmeye uygun bir mekanizma görülüyor mu (aria-invalid, aria-describedby ile bağlı açıklama ya da alert bölgesi)?',
    severity: 'Orta',
    hint: 'states.aria-invalid, description, role=alert; form yoksa belirsiz',
  },
  {
    id: 'F4',
    principle: 'feedback',
    question: 'Kullanıcının bulunduğu konum belirtilmiş mi (gezinmede aria-current, sekmelerde aria-selected)?',
    severity: 'Düşük',
    hint: 'states.aria-current, states.aria-selected',
  },
  {
    id: 'F5',
    principle: 'feedback',
    question: 'Stil kurallarında odak (:focus / :focus-visible) ve üzerine gelme (:hover) geri bildirimi tanımlı ve odak çerçevesi kaldırılmamış mı?',
    severity: 'Yüksek',
    hint: 'page.styleRules (okunamayan stil dosyaları varsa ve kural yoksa belirsiz)',
  },
  // Kısıtlar
  {
    id: 'C1',
    principle: 'constraints',
    question: 'Kullanılamayan eylemler disabled ya da aria-disabled ile açıkça belirtilmiş mi?',
    severity: 'Orta',
    hint: 'states.disabled, states.aria-disabled; görünür ama işlevsiz izlenimi veren öğe',
  },
  {
    id: 'C2',
    principle: 'constraints',
    question: 'Giriş alanları beklenen veri türüne uygun type ile sınırlandırılmış mı (email, tel, number, date, search vb.)?',
    severity: 'Orta',
    hint: 'inputType ve name birlikte; form alanı yoksa belirsiz',
  },
  {
    id: 'C3',
    principle: 'constraints',
    question: 'Seçenekleri sınırlı veriler için serbest metin yerine seçim denetimi (select, radio, checkbox) kullanılmış mı?',
    severity: 'Düşük',
    hint: 'role=combobox/radio/checkbox ve textbox adları',
  },
  {
    id: 'C4',
    principle: 'constraints',
    question: 'Biçim beklentisi olan alanlarda (tarih, telefon, TC kimlik no vb.) biçim yalnızca placeholder ile değil, etiket ya da açıklamayla belirtilmiş mi?',
    severity: 'Orta',
    hint: 'nameSource=placeholder, description',
  },
  // Eşleme
  {
    id: 'M1',
    principle: 'mapping',
    question: 'Form alanlarının etiketleri alanla programatik olarak eşleşmiş mi (label, aria-labelledby; yalnızca placeholder değil)?',
    severity: 'Yüksek',
    hint: 'form alanlarında nameSource=label/aria-labelledby/aria-label; placeholder/none sorunludur',
  },
  {
    id: 'M2',
    principle: 'mapping',
    question: 'Bağlantı ve düğme metinleri hedeflerini ya da sonuçlarını anlatıyor mu ("tıklayın", "buraya", "devamı" gibi belirsiz metin yok mu)?',
    severity: 'Orta',
    hint: 'role=link/button, name',
  },
  {
    id: 'M3',
    principle: 'mapping',
    question: 'İlgili kontroller aynı form ya da landmark içinde ve birbirine yakın konumlanmış mı?',
    severity: 'Düşük',
    hint: 'landmarkId, rect',
  },
  {
    id: 'M4',
    principle: 'mapping',
    question: 'Başlık hiyerarşisi içerik yapısını yansıtıyor mu (tek h1, düzey atlamadan sıralı başlıklar)?',
    severity: 'Orta',
    hint: 'kind=heading, headingLevel sırası',
  },
  {
    id: 'M5',
    principle: 'mapping',
    question: 'Açılır menü, akordeon ya da sekme gibi kontroller etkiledikleri içerikle ilişkilendirilmiş mi (aria-expanded, aria-controls, aria-haspopup)?',
    severity: 'Düşük',
    hint: 'states.aria-expanded/aria-controls/aria-haspopup; böyle kontrol yoksa belirsiz',
  },
  // Tutarlılık
  {
    id: 'K1',
    principle: 'consistency',
    question: 'Aynı işlevi gören öğeler (ör. birincil düğmeler) tutarlı görünüm kullanıyor mu (renk, arka plan, yazı boyutu, köşe yuvarlaklığı)?',
    severity: 'Orta',
    hint: 'style, fontSizePx; aynı role sahip öğeleri karşılaştır',
  },
  {
    id: 'K2',
    principle: 'consistency',
    question: 'Aynı adı taşıyan öğeler aynı tür işleve sahip mi (aynı metinle farklı hedef türüne giden bağlantı ya da farklı role sahip öğe yok mu)?',
    severity: 'Orta',
    hint: 'name, role, href',
  },
  {
    id: 'K3',
    principle: 'consistency',
    question: 'Metin içi bağlantılar tutarlı biçimde ayırt ediliyor mu (alt çizgi ya da çevresinden farklı renk)?',
    severity: 'Orta',
    hint: 'role=link, style.underline, style.color',
  },
  {
    id: 'K4',
    principle: 'consistency',
    question: 'Sayfa yaygın yerleşim düzenine uyuyor mu (banner/header, navigation, main, contentinfo/footer landmarkları)?',
    severity: 'Düşük',
    hint: 'kind=landmark, role',
  },
  {
    id: 'K5',
    principle: 'consistency',
    question: 'Arayüz dili tutarlı mı (öğe metinleri sayfa diliyle aynı dilde, karışık dil yok)?',
    severity: 'Düşük',
    hint: 'page.lang, name',
  },
  // Sağlarlık
  {
    id: 'A1',
    principle: 'affordance',
    question: 'Tıklanabilir öğeler semantik olarak doğru öğe ya da rolle mi işaretlenmiş (div/span yerine button/a; onclick taşıyan genel öğe yok mu)?',
    severity: 'Yüksek',
    hint: 'tag ve role; role=generic olan kind=interactive öğeler, kind=pointer-noninteractive',
  },
  {
    id: 'A2',
    principle: 'affordance',
    question: 'Tıklanabilir öğelerde tıklanabilirlik ipucu var mı (cursor: pointer, kenarlık, arka plan ya da alt çizgi)?',
    severity: 'Orta',
    hint: 'style.cursor, style.background, style.underline',
  },
  {
    id: 'A3',
    principle: 'affordance',
    question: 'Görünüm rolle uyumlu mu (düğmeler düğmeye, bağlantılar bağlantıya benziyor)?',
    severity: 'Orta',
    hint: 'role ile style karşılaştırması',
  },
  {
    id: 'A4',
    principle: 'affordance',
    question: 'Tıklanabilir öğeler yeterli boyutta mı (en az 24×24 px; birincil eylemlerde 44×44 px önerilir)?',
    severity: 'Orta',
    hint: 'rect.w, rect.h',
  },
  {
    id: 'A5',
    principle: 'affordance',
    question: 'Tıklanamayan öğeler tıklanabilir gibi görünmüyor mu (cursor: pointer olan ama etkileşimli olmayan öğe yok mu)?',
    severity: 'Düşük',
    hint: 'kind=pointer-noninteractive',
  },
]

export function questionById(id: string): RubricQuestion | undefined {
  return RUBRIC.find((q) => q.id === id)
}
