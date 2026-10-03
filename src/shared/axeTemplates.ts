// axe-core kuralları için Türkçe, öğeye özel açıklama ve düzeltme şablonları — TEK KAYNAK.
// Kural adları ve check verisi alanları kurulu axe-core 4.13.0'dan doğrulandı:
// axe.getRules() (WCAG 2.2 AA etiketli 70 kural) ve axe-core/locales/_template.json check mesajları
// (ör. color-contrast: fgColor/bgColor/contrastRatio/expectedContrastRatio; target-size: width/height/minSize;
// target-offset: closestOffset/minOffset; aria-*: values; aria-prohibited-attr: prohibited/role).
// axe'in İngilizce metni bulguda yalnızca "teknik ayrıntı" alanında kalır.

/** Şablona verilen öğe bağlamı. `name` maskelenmiş ve kısaltılmıştır; form değeri hiçbir zaman içermez. */
export interface RuleContext {
  /** Küçük harf etiket adı, ör. "button". */
  tag: string
  /** Açık ya da örtük rol, ör. "button", "feed". */
  role: string | null
  /** Erişilebilir ad ya da görünür metin (maskelenmiş, en çok 60 karakter); yoksa "". */
  name: string
  /** WCAG etiketi, ör. "WCAG 1.4.3". */
  wcag: string
  /** Check kimliği → axe check verisi (node.any/all/none). */
  checks: Record<string, unknown>
}

export interface RuleText {
  description: string
  fix: string
}

const ROLE_TR: Record<string, string> = {
  button: 'düğme',
  link: 'bağlantı',
  img: 'görsel',
  image: 'görsel',
  textbox: 'metin alanı',
  searchbox: 'arama kutusu',
  checkbox: 'onay kutusu',
  radio: 'seçenek düğmesi',
  combobox: 'açılır liste',
  listbox: 'liste kutusu',
  option: 'seçenek',
  slider: 'kaydırıcı',
  switch: 'aç/kapa düğmesi',
  heading: 'başlık',
  navigation: 'gezinme bölgesi',
  main: 'ana içerik bölgesi',
  banner: 'üst bilgi bölgesi',
  contentinfo: 'alt bilgi bölgesi',
  complementary: 'yan içerik bölgesi',
  form: 'form',
  region: 'bölge',
  dialog: 'iletişim kutusu',
  list: 'liste',
  listitem: 'liste öğesi',
  feed: 'akış (feed)',
  article: 'makale',
  menu: 'menü',
  menubar: 'menü çubuğu',
  menuitem: 'menü öğesi',
  tab: 'sekme',
  tablist: 'sekme listesi',
  tabpanel: 'sekme paneli',
  progressbar: 'ilerleme çubuğu',
  meter: 'ölçer',
  tooltip: 'ipucu',
  table: 'tablo',
  row: 'tablo satırı',
  cell: 'tablo hücresi',
  gridcell: 'tablo hücresi',
  columnheader: 'sütun başlığı',
  tree: 'ağaç',
  treeitem: 'ağaç öğesi',
  grid: 'ızgara',
}

const TAG_TR: Record<string, string> = {
  html: 'sayfanın kök öğesi',
  img: 'görsel',
  svg: 'SVG görseli',
  input: 'giriş alanı',
  select: 'açılır liste',
  textarea: 'metin alanı',
  a: 'bağlantı',
  button: 'düğme',
  iframe: 'çerçeve (iframe)',
  frame: 'çerçeve',
  video: 'video',
  audio: 'ses öğesi',
  ul: 'liste',
  ol: 'liste',
  li: 'liste öğesi',
  dl: 'tanım listesi',
  table: 'tablo',
  object: 'gömülü nesne (object)',
  area: 'görüntü haritası alanı',
  meta: '<meta> etiketi',
}

/** Öğeyi Türkçe tanımlar: `düğme "Ara" (<button>)` ya da `adsız bağlantı (<a>)`. */
export function elementPhrase(ctx: Pick<RuleContext, 'tag' | 'role' | 'name'>): string {
  if (!ctx.tag) return 'ilgili öğe'
  const kind = (ctx.role && ROLE_TR[ctx.role]) || TAG_TR[ctx.tag] || 'öğe'
  const name = ctx.name.trim()
  return name ? `${kind} "${name}" (<${ctx.tag}>)` : `${kind} (<${ctx.tag}>)`
}

function list(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function data(ctx: RuleContext, checkId: string): Record<string, unknown> {
  const d = ctx.checks[checkId]
  return d && typeof d === 'object' ? (d as Record<string, unknown>) : {}
}

/** Her kural için kısa Türkçe başlık (şablonu olmayan kurallarda yedek metinde kullanılır). */
export const RULE_TITLES_TR: Record<string, string> = {
  'area-alt': 'Görüntü haritası alanlarının metin alternatifi olmalı',
  'aria-allowed-attr': 'ARIA öznitelikleri öğenin rolüne izin verilenler olmalı',
  'aria-braille-equivalent': 'Braille ARIA özniteliklerinin Braille olmayan karşılığı olmalı',
  'aria-command-name': 'ARIA komut öğelerinin erişilebilir adı olmalı',
  'aria-conditional-attr': 'ARIA öznitelikleri rolün koşullarına uygun kullanılmalı',
  'aria-deprecated-role': 'Kullanımdan kaldırılmış ARIA rolleri kullanılmamalı',
  'aria-hidden-body': '<body> öğesinde aria-hidden="true" olmamalı',
  'aria-hidden-focus': 'aria-hidden öğeler odaklanabilir içerik barındırmamalı',
  'aria-input-field-name': 'ARIA giriş alanlarının erişilebilir adı olmalı',
  'aria-meter-name': 'ARIA ölçer öğelerinin erişilebilir adı olmalı',
  'aria-progressbar-name': 'ARIA ilerleme çubuklarının erişilebilir adı olmalı',
  'aria-prohibited-attr': 'Role izin verilmeyen ARIA öznitelikleri kullanılmamalı',
  'aria-required-attr': 'ARIA rolünün zorunlu öznitelikleri bulunmalı',
  'aria-required-children': 'ARIA rolünün zorunlu alt rolleri bulunmalı',
  'aria-required-parent': 'ARIA rolünün zorunlu üst rolü bulunmalı',
  'aria-roledescription': 'aria-roledescription yalnızca anlamsal rollerde kullanılmalı',
  'aria-roles': 'ARIA rol değerleri geçerli olmalı',
  'aria-tab-name': 'ARIA sekmelerinin erişilebilir adı olmalı',
  'aria-toggle-field-name': 'ARIA aç/kapa alanlarının erişilebilir adı olmalı',
  'aria-tooltip-name': 'ARIA ipuçlarının erişilebilir adı olmalı',
  'aria-valid-attr-value': 'ARIA öznitelik değerleri geçerli olmalı',
  'aria-valid-attr': 'ARIA öznitelik adları geçerli olmalı',
  'audio-caption': 'Ses öğelerinin metin karşılığı olmalı',
  'autocomplete-valid': 'autocomplete değeri geçerli ve alanın amacına uygun olmalı',
  'avoid-inline-spacing': 'Satır içi stil, metin aralığı ayarını engellememeli',
  blink: '<blink> öğesi kullanılmamalı',
  'button-name': 'Düğmelerin erişilebilir adı olmalı',
  bypass: 'Tekrarlanan içeriği atlama yolu olmalı',
  'color-contrast': 'Metin ile arka plan arasında yeterli kontrast olmalı',
  'css-orientation-lock': 'İçerik tek bir ekran yönüne kilitlenmemeli',
  'definition-list': 'Tanım listeleri yalnızca <dt>/<dd> grupları içermeli',
  dlitem: '<dt>/<dd> öğeleri bir <dl> içinde olmalı',
  'document-title': 'Sayfanın boş olmayan bir <title> öğesi olmalı',
  'duplicate-id-aria': 'ARIA ve etiketlerde başvurulan id değerleri benzersiz olmalı',
  'form-field-multiple-labels': 'Bir form alanının birden çok etiketi olmamalı',
  'frame-focusable-content': 'Odaklanabilir içerikli çerçeveler tabindex="-1" olmamalı',
  'frame-title-unique': 'Çerçeve başlıkları benzersiz olmalı',
  'frame-title': 'Çerçevelerin erişilebilir adı olmalı',
  'html-has-lang': '<html> öğesinde lang özniteliği olmalı',
  'html-lang-valid': '<html lang> değeri geçerli olmalı',
  'html-xml-lang-mismatch': 'lang ve xml:lang aynı dili göstermeli',
  'image-alt': 'Görsellerin metin alternatifi olmalı',
  'input-button-name': 'Giriş düğmelerinin erişilebilir adı olmalı',
  'input-image-alt': 'Görsel düğmelerin metin alternatifi olmalı',
  'label-content-name-mismatch': 'Erişilebilir ad, görünür etiketi içermeli',
  label: 'Form alanlarının etiketi olmalı',
  'link-in-text-block': 'Metin içindeki bağlantılar yalnızca renkle ayırt edilmemeli',
  'link-name': 'Bağlantıların erişilebilir adı olmalı',
  list: 'Listeler yalnızca <li> ve izin verilen öğeleri içermeli',
  listitem: '<li> öğeleri bir <ul>/<ol> içinde olmalı',
  marquee: '<marquee> öğesi kullanılmamalı',
  'meta-refresh': 'Sayfa zamanlı olarak yenilenmemeli',
  'meta-viewport': 'Yakınlaştırma (zoom) engellenmemeli',
  'nested-interactive': 'Etkileşimli öğeler iç içe olmamalı',
  'no-autoplay-audio': 'Ses kendiliğinden 3 saniyeden uzun çalmamalı',
  'object-alt': '<object> öğelerinin metin alternatifi olmalı',
  'p-as-heading': 'Kalın/büyük paragraflar başlık yerine kullanılmamalı',
  'role-img-alt': 'role="img" öğelerinin metin alternatifi olmalı',
  'scrollable-region-focusable': 'Kaydırılabilir bölgeler klavyeyle erişilebilir olmalı',
  'select-name': 'Açılır listelerin erişilebilir adı olmalı',
  'server-side-image-map': 'Sunucu taraflı görüntü haritası kullanılmamalı',
  'summary-name': '<summary> öğelerinin erişilebilir adı olmalı',
  'svg-img-alt': 'Görsel rolündeki SVG öğelerinin metin alternatifi olmalı',
  'table-fake-caption': 'Tablo başlığı için <caption> kullanılmalı',
  'target-size': 'Dokunma hedefleri en az 24×24 CSS pikseli olmalı',
  'td-has-header': 'Büyük tablolarda veri hücrelerinin başlığı olmalı',
  'td-headers-attr': 'headers özniteliği aynı tablodaki başlıklara işaret etmeli',
  'th-has-data-cells': 'Tablo başlıklarının ait olduğu veri hücreleri olmalı',
  'valid-lang': 'lang değerleri geçerli olmalı',
  'video-caption': 'Videoların altyazısı olmalı',
}

type Template = (ctx: RuleContext, el: string) => RuleText

/** Öğeye özel şablonlar. Ölçülen değerler (renk, boyut, eksik roller/öznitelikler) metne yazılır. */
export const RULE_TEMPLATES: Record<string, Template> = {
  'color-contrast': (ctx, el) => {
    const d = data(ctx, 'color-contrast')
    if (d.fgColor && d.bgColor && d.contrastRatio !== undefined) {
      const expected = String(d.expectedContrastRatio ?? '4.5:1')
      return {
        description: `${el} metninin kontrastı ${String(d.contrastRatio)}:1; bu metin boyutu için en az ${expected} gerekiyor.`,
        fix: `Metin rengi ${String(d.fgColor)} ile arka plan ${String(d.bgColor)} arasındaki kontrastı en az ${expected} yapın: metni koyulaştırın ya da arka planı açın, sonra oranı yeniden ölçün.`,
      }
    }
    return {
      description: `${el} metninin arka planla kontrastı yetersiz (değer ölçülemedi; arka plan görsel ya da degrade olabilir).`,
      fix: `${el} için metin ve arka plan renklerini normal metinde en az 4.5:1, büyük metinde en az 3:1 kontrast verecek şekilde değiştirin.`,
    }
  },
  'image-alt': (_ctx, el) => ({
    description: `${el} için metin alternatifi (alt) yok; ekran okuyucu görselin ne anlattığını söyleyemez.`,
    fix: `${el} öğesine görselin anlamını anlatan alt="…" ekleyin. Görsel yalnızca süs amaçlıysa alt="" verin.`,
  }),
  'input-image-alt': (_ctx, el) => ({
    description: `Görsel düğme ${el} için metin alternatifi yok; düğmenin ne yaptığı duyurulmaz.`,
    fix: `${el} öğesine düğmenin işlevini anlatan alt ekleyin (ör. alt="Ara").`,
  }),
  'role-img-alt': (_ctx, el) => ({
    description: `role="img" olan ${el} için metin alternatifi yok.`,
    fix: `${el} öğesine aria-label ya da aria-labelledby ile görselin anlamını veren bir ad verin.`,
  }),
  'svg-img-alt': (_ctx, el) => ({
    description: `Görsel rolündeki ${el} için metin alternatifi yok.`,
    fix: `${el} içine <title> ekleyin ya da aria-label / aria-labelledby ile ad verin.`,
  }),
  'area-alt': (_ctx, el) => ({
    description: `${el} için metin alternatifi yok; bağlantının hedefi duyurulmaz.`,
    fix: `${el} öğesine bağlantının hedefini anlatan alt ekleyin.`,
  }),
  'object-alt': (_ctx, el) => ({
    description: `${el} için metin alternatifi yok.`,
    fix: `${el} öğesine aria-label ekleyin ya da içine içeriği anlatan metin yazın.`,
  }),
  label: (_ctx, el) => ({
    description: `${el} için erişilebilir bir etiket yok; ekran okuyucu alanın ne istediğini söyleyemez.`,
    fix: `${el} alanını görünür bir <label for="alan-id"> ile ilişkilendirin. Görünür etiket mümkün değilse aria-label kullanın; placeholder tek başına etiket sayılmaz.`,
  }),
  'select-name': (_ctx, el) => ({
    description: `${el} için erişilebilir bir ad yok.`,
    fix: `${el} öğesini görünür bir <label for="…"> ile ilişkilendirin ya da aria-label verin.`,
  }),
  'aria-input-field-name': (_ctx, el) => ({
    description: `ARIA giriş alanı ${el} için erişilebilir bir ad yok.`,
    fix: `${el} öğesine aria-label ya da görünür etiketine bağlanan aria-labelledby ekleyin.`,
  }),
  'aria-toggle-field-name': (_ctx, el) => ({
    description: `Aç/kapa öğesi ${el} için erişilebilir bir ad yok.`,
    fix: `${el} öğesine aria-label ya da aria-labelledby ile ne açıp kapattığını anlatan bir ad verin.`,
  }),
  'button-name': (_ctx, el) => ({
    description: `${el} için erişilebilir bir ad yok; ekran okuyucu yalnızca "düğme" der.`,
    fix: `${el} içine görünür metin yazın ya da (yalnızca simge varsa) aria-label="…" ile düğmenin işlevini adlandırın.`,
  }),
  'input-button-name': (_ctx, el) => ({
    description: `Giriş düğmesi ${el} için erişilebilir bir ad yok.`,
    fix: `${el} öğesine value="…" ya da aria-label ile düğmenin işlevini yazın.`,
  }),
  'link-name': (_ctx, el) => ({
    description: `${el} için erişilebilir bir ad yok; bağlantının nereye gittiği duyurulmaz.`,
    fix: `${el} içine hedefi anlatan metin ekleyin; bağlantı yalnızca simge/görselse görsele alt ya da bağlantıya aria-label verin.`,
  }),
  'target-size': (ctx, el) => {
    const size = data(ctx, 'target-size')
    const offset = data(ctx, 'target-offset')
    const measured =
      size.width !== undefined && size.height !== undefined
        ? `${String(size.width)}×${String(size.height)} px`
        : offset.closestOffset !== undefined
          ? `komşularına güvenli tıklama aralığı ${String(offset.closestOffset)} px`
          : 'ölçülen boyut 24×24 px altında'
    const min = String(size.minSize ?? offset.minOffset ?? 24)
    return {
      description: `${el} dokunma hedefi küçük (${measured}; en az ${min}×${min} px ya da yeterli boşluk gerekiyor).`,
      fix: `${el} için tıklanabilir alanı en az ${min}×${min} CSS pikseli yapın (padding ya da min-width/min-height ile) veya komşu hedeflerle arasında ${min} px çaplı boşluk bırakın.`,
    }
  },
  'html-has-lang': () => ({
    description: 'Sayfanın dili tanımlanmamış (<html> öğesinde lang yok); ekran okuyucu yanlış dilde okuyabilir.',
    fix: 'Kök öğeye sayfanın dilini ekleyin: <html lang="tr">.',
  }),
  'html-lang-valid': () => ({
    description: '<html lang> değeri geçerli bir dil kodu değil.',
    fix: 'lang değerini geçerli bir BCP 47 koduyla değiştirin (ör. lang="tr").',
  }),
  'valid-lang': (_ctx, el) => ({
    description: `${el} öğesindeki lang değeri geçerli bir dil kodu değil.`,
    fix: `${el} öğesinin lang değerini geçerli bir BCP 47 koduyla değiştirin (ör. lang="en").`,
  }),
  'html-xml-lang-mismatch': () => ({
    description: '<html> öğesinde lang ve xml:lang farklı dilleri gösteriyor.',
    fix: 'lang ve xml:lang değerlerini aynı dile ayarlayın ya da xml:lang değerini kaldırın.',
  }),
  'document-title': () => ({
    description: 'Sayfanın boş olmayan bir <title> öğesi yok; sekme ve ekran okuyucu sayfayı adlandıramaz.',
    fix: '<head> içine sayfanın içeriğini anlatan bir <title> ekleyin (ör. "Randevu Al — Hastane Adı").',
  }),
  'aria-required-children': (ctx, el) => {
    const missing = list(data(ctx, 'aria-required-children').values)
    return {
      description: missing
        ? `${el} öğesinin zorunlu alt rolü yok ya da izin verilmeyen alt öğeleri var (${missing}).`
        : `${el} öğesinin rolünün gerektirdiği alt rol(ler) bulunmuyor.`,
      fix: missing
        ? `${el} içindeki doğrudan alt öğeleri gereken rolle işaretleyin (${missing}; ör. role="feed" için <article> ya da role="article"), uymayan alt öğeleri dışarı taşıyın.`
        : `${el} içindeki doğrudan alt öğelere rolün gerektirdiği alt rolleri verin ya da üst öğenin rolünü kaldırın.`,
    }
  },
  'aria-required-parent': (ctx, el) => {
    const parents = list(data(ctx, 'aria-required-parent').values)
    return {
      description: `${el} öğesinin rolü belirli bir üst rol içinde olmalı${parents ? ` (${parents})` : ''}, ama böyle bir üst öğe yok.`,
      fix: `${el} öğesini${parents ? ` role="${parents.split(',')[0].trim()}" olan` : ' gereken role sahip'} bir üst öğenin içine taşıyın ya da kendi rolünü kaldırın.`,
    }
  },
  'aria-allowed-attr': (ctx, el) => {
    const attrs = list(data(ctx, 'aria-allowed-attr').values)
    return {
      description: `${el} öğesinde rolüne izin verilmeyen ARIA öznitelikleri var${attrs ? `: ${attrs}` : ''}.`,
      fix: `${el} öğesinden ${attrs || 'izin verilmeyen ARIA özniteliklerini'} kaldırın ya da öğeye bu öznitelikleri destekleyen bir rol verin.`,
    }
  },
  'aria-prohibited-attr': (ctx, el) => {
    const d = data(ctx, 'aria-prohibited-attr')
    const attrs = list(d.prohibited)
    return {
      description: `${el} öğesinde bu rolde yasak olan ${attrs || 'ARIA öznitelikleri'} kullanılmış${d.role ? ` (rol: ${String(d.role)})` : ''}.`,
      fix: `${el} öğesinden ${attrs || 'yasak öznitelikleri'} kaldırın; ad vermek gerekiyorsa görünür metin kullanın ya da öğeye ad almayı destekleyen bir rol verin.`,
    }
  },
  'aria-required-attr': (ctx, el) => {
    const attrs = list(data(ctx, 'aria-required-attr').values)
    return {
      description: `${el} öğesinin rolü için zorunlu ARIA öznitelikleri eksik${attrs ? `: ${attrs}` : ''}.`,
      fix: `${el} öğesine ${attrs || 'rolün zorunlu özniteliklerini'} ekleyin ve değerlerini öğenin gerçek durumuna göre güncel tutun.`,
    }
  },
  'aria-valid-attr-value': (ctx, el) => {
    const attrs = list(data(ctx, 'aria-valid-attr-value').values)
    return {
      description: `${el} öğesinde geçersiz ARIA öznitelik değeri var${attrs ? `: ${attrs}` : ''}.`,
      fix: `${el} öğesindeki ${attrs || 'ARIA özniteliklerinin'} değerini geçerli bir değerle değiştirin (ör. aria-expanded="true|false", aria-controls sayfada var olan bir id).`,
    }
  },
  'aria-valid-attr': (ctx, el) => {
    const attrs = list(data(ctx, 'aria-valid-attr').values)
    return {
      description: `${el} öğesinde geçersiz (yazımı hatalı ya da var olmayan) ARIA öznitelik adı var${attrs ? `: ${attrs}` : ''}.`,
      fix: `${el} öğesindeki ${attrs || 'hatalı ARIA özniteliklerini'} doğru yazımla değiştirin ya da kaldırın.`,
    }
  },
  'aria-roles': (_ctx, el) => ({
    description: `${el} öğesinin role değeri geçerli bir ARIA rolü değil.`,
    fix: `${el} öğesinin role değerini geçerli bir ARIA rolüyle değiştirin ya da role özniteliğini kaldırıp uygun HTML öğesini kullanın.`,
  }),
  'aria-hidden-focus': (_ctx, el) => ({
    description: `aria-hidden="true" olan ${el} içinde klavyeyle odaklanabilen öğeler var; ekran okuyucu kullanıcısı görünmeyen bir öğeye odaklanır.`,
    fix: `${el} içindeki odaklanabilir öğelere tabindex="-1" verin, inert kullanın ya da aria-hidden özniteliğini kaldırın.`,
  }),
  'aria-hidden-body': () => ({
    description: '<body> öğesinde aria-hidden="true" var; sayfanın tamamı ekran okuyucudan gizleniyor.',
    fix: '<body> öğesinden aria-hidden özniteliğini kaldırın.',
  }),
  'aria-command-name': (_ctx, el) => ({
    description: `ARIA komut öğesi ${el} için erişilebilir bir ad yok.`,
    fix: `${el} öğesine görünür metin, aria-label ya da aria-labelledby ile ad verin.`,
  }),
  'aria-progressbar-name': (_ctx, el) => ({
    description: `İlerleme çubuğu ${el} için erişilebilir bir ad yok; neyin ilerlediği duyurulmaz.`,
    fix: `${el} öğesine aria-label ya da aria-labelledby ile ad verin (ör. "Dosya yükleniyor").`,
  }),
  'duplicate-id-aria': (_ctx, el) => ({
    description: `${el} öğesinin id değeri sayfada birden çok kez kullanılmış ve ARIA ya da <label> tarafından başvuruluyor; yanlış öğe adlandırılabilir.`,
    fix: `${el} ve aynı id'yi taşıyan diğer öğelere benzersiz id değerleri verin, başvuruları (for, aria-labelledby, aria-describedby) güncelleyin.`,
  }),
  list: (ctx, el) => {
    const bad = list(data(ctx, 'only-listitems').values)
    return {
      description: `${el} doğrudan <li> dışında öğeler içeriyor${bad ? ` (${bad})` : ''}.`,
      fix: `${el} içindeki doğrudan alt öğeleri <li> içine alın; <ul>/<ol> altında yalnızca <li>, <script> ve <template> bulunsun.`,
    }
  },
  listitem: (_ctx, el) => ({
    description: `${el} bir <ul>, <ol> ya da role="list" içinde değil; liste olarak duyurulmaz.`,
    fix: `${el} öğesini bir <ul> ya da <ol> içine taşıyın.`,
  }),
  'definition-list': (_ctx, el) => ({
    description: `${el} yalnızca <dt>/<dd> grupları içermiyor.`,
    fix: `${el} içinde yalnızca <dt> (terim) ve <dd> (açıklama) çiftleri (gerekirse <div> ile gruplanmış) bırakın.`,
  }),
  dlitem: (_ctx, el) => ({
    description: `${el} bir <dl> içinde değil.`,
    fix: `${el} öğesini bir <dl> içine taşıyın.`,
  }),
  'frame-title': (_ctx, el) => ({
    description: `${el} için erişilebilir bir ad (title) yok; içeriği duyurulmaz.`,
    fix: `${el} öğesine içeriğini anlatan bir title ekleyin (ör. title="Harita").`,
  }),
  'nested-interactive': (_ctx, el) => ({
    description: `${el} içinde başka etkileşimli öğeler var; ekran okuyucu ve klavye iç öğeye ulaşamayabilir.`,
    fix: `${el} içindeki bağlantı/düğme gibi öğeleri dışarı taşıyın ya da tek bir etkileşimli öğe kalacak şekilde yapıyı sadeleştirin.`,
  }),
  'scrollable-region-focusable': (_ctx, el) => ({
    description: `Kaydırılabilir ${el} klavyeyle odaklanamıyor; içeriği klavyeyle kaydırılamaz.`,
    fix: `${el} öğesine tabindex="0" ve bölgenin içeriğini anlatan bir aria-label verin ya da içine odaklanabilir bir öğe ekleyin.`,
  }),
  'autocomplete-valid': (_ctx, el) => ({
    description: `${el} alanının autocomplete değeri geçerli değil ya da alanın amacıyla uyuşmuyor.`,
    fix: `${el} alanının autocomplete değerini HTML standardındaki belirteçlerden alanın amacına uyanla değiştirin (ör. "email", "tel", "given-name").`,
  }),
  'link-in-text-block': (ctx, el) => {
    const d = data(ctx, 'link-in-text-block')
    const ratio = d.contrastRatio !== undefined ? ` (çevre metinle kontrast ${String(d.contrastRatio)}:1, en az ${String(d.requiredContrastRatio ?? 3)}:1 gerekiyor)` : ''
    return {
      description: `Metin içindeki ${el} çevresindeki metinden yalnızca renkle ayrılıyor${ratio}.`,
      fix: `${el} için alt çizgi (text-decoration: underline) ekleyin ya da çevre metinle en az 3:1 renk kontrastı sağlayın.`,
    }
  },
  'meta-viewport': () => ({
    description: 'Sayfa yakınlaştırmayı (zoom) engelliyor (user-scalable=no ya da düşük maximum-scale).',
    fix: '<meta name="viewport"> içinden user-scalable=no ifadesini kaldırın ve maximum-scale değerini en az 5 yapın (ya da hiç yazmayın).',
  }),
  bypass: () => ({
    description: 'Sayfada tekrarlanan içeriği atlamanın bir yolu yok (atlama bağlantısı, <main> ya da başlık yapısı bulunamadı).',
    fix: 'Sayfanın başına "İçeriğe geç" bağlantısı ekleyin ve ana içeriği <main> ile işaretleyin.',
  }),
  'summary-name': (_ctx, el) => ({
    description: `${el} için erişilebilir bir ad yok.`,
    fix: `${el} içine açılır bölümün konusunu anlatan metin yazın.`,
  }),
  'th-has-data-cells': (_ctx, el) => ({
    description: `Tablo başlığı ${el} hiçbir veri hücresiyle ilişkili değil.`,
    fix: `${el} başlığının altında/yanında veri hücreleri olduğundan emin olun ya da başlık olarak işaretlemeyi kaldırın.`,
  }),
  'td-headers-attr': (_ctx, el) => ({
    description: `${el} hücresinin headers özniteliği aynı tablodaki başlıklara işaret etmiyor.`,
    fix: `${el} hücresinin headers değerini aynı tablodaki <th> öğelerinin id'leriyle güncelleyin.`,
  }),
  'form-field-multiple-labels': (_ctx, el) => ({
    description: `${el} alanının birden çok etiketi var; ekran okuyucular farklı etiketler okuyabilir.`,
    fix: `${el} alanını tek bir <label> ile ilişkilendirin; ek açıklamalar için aria-describedby kullanın.`,
  }),
  'label-content-name-mismatch': (_ctx, el) => ({
    description: `${el} öğesinin erişilebilir adı görünür etiketini içermiyor; sesli komutla bu öğe seçilemeyebilir.`,
    fix: `${el} öğesinin aria-label değerini görünür metinle başlayacak şekilde değiştirin ya da aria-label'ı kaldırın.`,
  }),
  'video-caption': (_ctx, el) => ({
    description: `${el} için altyazı yok.`,
    fix: `${el} öğesine <track kind="captions" srclang="tr" src="…"> ile altyazı ekleyin.`,
  }),
  'meta-refresh': () => ({
    description: 'Sayfa zamanlı olarak kendini yeniliyor ya da yönlendiriyor; kullanıcı okumayı bitiremeden içerik değişebilir.',
    fix: '<meta http-equiv="refresh"> öğesini kaldırın; yönlendirme gerekiyorsa sunucu tarafında yapın.',
  }),
}

/** Şablonu olmayan kurallar için Türkçe yedek metin. axe'in İngilizce metni kullanılmaz. */
export function fallbackRuleText(ruleId: string, ctx: RuleContext): RuleText {
  const el = elementPhrase(ctx)
  const title = RULE_TITLES_TR[ruleId]
  const rule = title ? `"${title}" kuralı` : `"${ruleId}" erişilebilirlik kuralı`
  return {
    description: `${el}, ${rule} karşılamıyor (${ctx.wcag}).`,
    fix: `${el} öğesini ${ctx.wcag} ölçütüne uygun hale getirin: ${title ? `${title.charAt(0).toLocaleLowerCase('tr')}${title.slice(1)}.` : 'kuralın gerektirdiği değişikliği yapın.'} Kuralın teknik açıklaması ve kaynağı "Teknik ayrıntı" bölümündedir.`,
  }
}

/** Bulgunun Türkçe açıklaması ve somut önerisi: önce kurala özel şablon, yoksa Türkçe yedek metin. */
/** Cümle başını büyük harf yapar (Türkçe kurallarıyla: "i" → "İ"). */
export function capitalizeTr(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase('tr') + text.slice(1) : text
}

export function ruleText(ruleId: string, ctx: RuleContext): RuleText {
  const template = RULE_TEMPLATES[ruleId]
  const t = template ? template(ctx, elementPhrase(ctx)) : fallbackRuleText(ruleId, ctx)
  return { description: capitalizeTr(t.description), fix: capitalizeTr(t.fix) }
}

/** "Elle incelenmeli" (axe incomplete) listesi için kural düzeyinde Türkçe açıklama. */
export function manualReviewDescription(ruleId: string, wcag: string): string {
  const title = RULE_TITLES_TR[ruleId] ?? `"${ruleId}" erişilebilirlik kuralı`
  return `${title} (${wcag}): axe bu öğelerde kesin karar veremedi; her birini elle kontrol edin.`
}
