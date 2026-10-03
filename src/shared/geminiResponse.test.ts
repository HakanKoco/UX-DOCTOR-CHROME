import { describe, expect, it } from 'vitest'
import { describeGeminiHttpError, parseGeminiResponse } from './geminiResponse'

// Yanıt nesneleri, resmi GenerateContentResponse yapısına göre kurgulanmış birim testi girdileridir; gerçek ölçüm değildir.

const ok = (parts: { text?: string; thought?: boolean }[], finishReason = 'STOP') => ({
  candidates: [{ content: { role: 'model', parts }, finishReason }],
  usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 50 },
  modelVersion: 'gemini-3.8-flash-001',
})

describe('parseGeminiResponse', () => {
  it('metin parçalarını birleştirir, düşünce parçalarını atar, kullanım ve sürümü eşler', () => {
    const r = parseGeminiResponse(ok([{ text: 'düşünce', thought: true }, { text: '{"answers":' }, { text: '[]}' }]), 'gemini-3.8-flash')
    expect(r).toEqual({
      ok: true,
      rawText: '{"answers":[]}',
      servedModel: 'gemini-3.8-flash-001',
      stopReason: 'STOP',
      usage: { inputTokens: 1000, outputTokens: 250, cacheReadInputTokens: null },
    })
  })

  it('modelVersion yoksa istenen model yazılır', () => {
    const data = { candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }] }
    const r = parseGeminiResponse(data, 'gemini-3.5-flash-lite')
    expect(r).toMatchObject({ ok: true, servedModel: 'gemini-3.5-flash-lite', usage: null })
  })

  it('MAX_TOKENS kesik yanıt olarak reddedilir', () => {
    const r = parseGeminiResponse(ok([{ text: '{"answers":[' }], 'MAX_TOKENS'), 'gemini-3.8-flash')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('MAX_TOKENS')
  })

  it('SAFETY ile durdurulan yanıt reddedilir', () => {
    const r = parseGeminiResponse(ok([], 'SAFETY'), 'gemini-3.8-flash')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('SAFETY')
  })

  it('promptFeedback.blockReason doluysa reddedilir', () => {
    const r = parseGeminiResponse({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }, 'gemini-3.8-flash')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('PROHIBITED_CONTENT')
  })

  it('aday yoksa ya da metin boşsa reddedilir', () => {
    expect(parseGeminiResponse({}, 'gemini-3.8-flash').ok).toBe(false)
    expect(parseGeminiResponse(null, 'gemini-3.8-flash').ok).toBe(false)
    expect(parseGeminiResponse(ok([{ text: 'x', thought: true }]), 'gemini-3.8-flash').ok).toBe(false)
  })
})

describe('describeGeminiHttpError', () => {
  it('429 için istek sınırı mesajı üretir', () => {
    const msg = describeGeminiHttpError(429, { error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } })
    expect(msg).toContain('429')
    expect(msg).toContain('RESOURCE_EXHAUSTED')
  })

  it('hata metninde anahtar geçse bile maskelenir', () => {
    const fakeKey = 'TEST-ONLY-not-a-real-key-123456'
    const msg = describeGeminiHttpError(400, { error: { message: `API key ${fakeKey} not valid`, status: 'INVALID_ARGUMENT' } }, fakeKey)
    expect(msg).not.toContain(fakeKey)
    expect(msg).toContain('[ANAHTAR]')
  })

  it('geçersiz anahtar (400 + API_KEY_INVALID) anahtar hatası olarak çevrilir', () => {
    // Gövde biçimi, models.get'e sahte anahtarla yapılan istekte gözlenen yanıttan alınmıştır.
    const body = {
      error: {
        code: 400,
        message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' },
        ],
      },
    }
    expect(describeGeminiHttpError(400, body)).toBe('Gemini API anahtarı geçersiz (400 API_KEY_INVALID).')
  })

  it('anahtarsız istek (403 PERMISSION_DENIED) erişim hatası olarak çevrilir', () => {
    const body = { error: { code: 403, message: "Method doesn't allow unregistered callers", status: 'PERMISSION_DENIED' } }
    expect(describeGeminiHttpError(403, body)).toContain('403 PERMISSION_DENIED')
  })

  it('gövde JSON değilse de anlamlı mesaj döner', () => {
    expect(describeGeminiHttpError(503, null)).toContain('503')
    expect(describeGeminiHttpError(404, null)).toContain('Model bulunamadı')
  })
})
