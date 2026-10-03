// Tarayıcı sayfa çevirisinin (Chrome / Google Çeviri) açık olup olmadığının sezgisel tespiti (saf fonksiyon).
//
// Resmi bir Chrome dokümanı bulunamadı. Kullanılan işaretler gözleme ve üçüncü taraf kaynaklara dayanır:
// - <html> öğesine "translated-ltr" / "translated-rtl" sınıfı eklenir
//   (https://www.ctrl.blog/entry/detect-machine-translated-webpages.html),
// - metin düğümleri <font style="vertical-align: inherit;"> sarmalayıcılarıyla değiştirilir
//   (https://issues.chromium.org/issues/41407169).
// Çeviri açıkken DOM değişir; seçiciler çeviri kapanınca geçersizleşebilir ve <html lang> çeviri diline döner.

export interface TranslationSignals {
  htmlClasses: string[]
  /** style özniteliğinde "vertical-align: inherit" bulunan <font> öğesi sayısı. */
  fontWrapperCount: number
}

export interface TranslationResult {
  detected: boolean
  reasons: string[]
}

export function detectTranslation(signals: TranslationSignals): TranslationResult {
  const reasons: string[] = []
  const cls = signals.htmlClasses.find((c) => c === 'translated-ltr' || c === 'translated-rtl')
  if (cls) reasons.push(`<html> öğesinde "${cls}" sınıfı var.`)
  if (signals.fontWrapperCount > 0) reasons.push(`Çeviri sarmalayıcısı <font> öğeleri var (${signals.fontWrapperCount} adet).`)
  return { detected: reasons.length > 0, reasons }
}
