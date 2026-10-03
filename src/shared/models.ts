// Seçilebilir Claude modelleri ve her modelin kabul ettiği parametreler.
// Kaynak: Claude API dokümantasyonu (model tablosu, "Thinking & Effort" bölümü).
// - Opus 5.5 ve Sonnet 5.5: temperature gönderilirse 400 döner; tutarlılık için effort sabitlenir.
// - Haiku 4.5: effort desteklenmez; temperature 0 gönderilir.

export type ModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-4-5'

export interface ModelOption {
  id: ModelId
  label: string
  /** output_config.effort gönderilebilir mi */
  supportsEffort: boolean
  /** temperature parametresi kabul ediliyor mu */
  supportsTemperature: boolean
  /** Sunucu taraflı "fallbacks: default" (ret durumunda başka modele aktarım) destekleniyor mu */
  supportsServerFallback: boolean
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5 (varsayılan, en yetenekli)',
    supportsEffort: true,
    supportsTemperature: false,
    supportsServerFallback: true,
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5 (daha hızlı, daha ucuz)',
    supportsEffort: true,
    supportsTemperature: false,
    supportsServerFallback: true,
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5 (en ucuz, temperature 0)',
    supportsEffort: false,
    supportsTemperature: true,
    supportsServerFallback: false,
  },
]

export const DEFAULT_MODEL: ModelId = 'claude-opus-5-5'

/** Tüm çalıştırmalarda sabit tutulan effort düzeyi (Opus 5.5 varsayılanı da "medium"; açıkça yazıyoruz). */
export const FIXED_EFFORT = 'medium' as const

export function getModelOption(id: string): ModelOption | undefined {
  return MODEL_OPTIONS.find((m) => m.id === id)
}

export function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && MODEL_OPTIONS.some((m) => m.id === value)
}
