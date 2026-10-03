import { describe, expect, it } from 'vitest'
import { detectTranslation } from './translation'

describe('detectTranslation', () => {
  it('işaret yoksa çeviri yok', () => {
    expect(detectTranslation({ htmlClasses: ['no-js'], fontWrapperCount: 0 })).toEqual({ detected: false, reasons: [] })
  })
  it('translated-ltr / translated-rtl sınıfını yakalar', () => {
    expect(detectTranslation({ htmlClasses: ['translated-ltr'], fontWrapperCount: 0 }).detected).toBe(true)
    expect(detectTranslation({ htmlClasses: ['translated-rtl'], fontWrapperCount: 0 }).reasons[0]).toContain('translated-rtl')
  })
  it('çeviri sarmalayıcısı <font> öğelerini yakalar', () => {
    const r = detectTranslation({ htmlClasses: [], fontWrapperCount: 12 })
    expect(r.detected).toBe(true)
    expect(r.reasons[0]).toContain('12')
  })
})
