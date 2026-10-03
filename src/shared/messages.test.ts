import { describe, expect, it } from 'vitest'
import { STALE_WORKER_MESSAGE, interpretVerifyResponse } from './messages'

describe('interpretVerifyResponse', () => {
  it('eski service worker yanıtı (provider alanı yok) kabul edilmez; eklentiyi yenileme mesajı döner', () => {
    // Önceki sürümün service worker'ı provider'ı yok sayıp Claude anahtarını okuyordu; yanıtı tam olarak buydu.
    const stale = { ok: false, message: 'API anahtarı ayarlanmamış. Ayarlar sayfasından anahtarınızı girin.' }
    expect(interpretVerifyResponse('gemini', stale)).toEqual({ ok: false, message: STALE_WORKER_MESSAGE, provider: 'gemini' })
  })

  it('başka sağlayıcıya ait yanıt kabul edilmez', () => {
    const r = interpretVerifyResponse('gemini', { ok: true, provider: 'claude', message: 'Anahtar geçerli.' })
    expect(r.ok).toBe(false)
    expect(r.message).toBe(STALE_WORKER_MESSAGE)
  })

  it('yanıt hiç gelmezse kabul edilmez', () => {
    expect(interpretVerifyResponse('claude', undefined).ok).toBe(false)
  })

  it('istenen sağlayıcıya ait yanıt aynen geçer', () => {
    const ok = { ok: true, provider: 'gemini' as const, message: 'Anahtar geçerli.' }
    expect(interpretVerifyResponse('gemini', ok)).toBe(ok)
    const fail = { ok: false, provider: 'gemini' as const, message: 'Gemini API anahtarı geçersiz (400 API_KEY_INVALID).' }
    expect(interpretVerifyResponse('gemini', fail)).toBe(fail)
  })
})
