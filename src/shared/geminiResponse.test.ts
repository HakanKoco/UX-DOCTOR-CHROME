import { describe, expect, it } from 'vitest'
import {
  buildGeminiDiagnostics,
  describeGeminiHttpError,
  diagnosticsRows,
  keyShape,
  parseGeminiResponse,
} from './geminiResponse'

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
    expect(describeGeminiHttpError(400, body)).toContain('Gemini API anahtarı geçersiz (400 API_KEY_INVALID)')
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

// Gövde biçimleri, 2026-10-03'te sahte anahtarlarla gözlenen gerçek Google yanıtlarından alınmıştır.
const FAKE_KEY = 'AQ.TEST-ONLY-dummy-not-a-real-key-0000'
const errBody = (code: number, status: string, message: string, reason?: string) => ({
  error: {
    code,
    message,
    status,
    ...(reason ? { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason, domain: 'googleapis.com' }] } : {}),
  },
})

describe('Gemini hata teşhisi', () => {
  const cases: { status: number; body: ReturnType<typeof errBody>; expectText: string }[] = [
    {
      status: 401,
      body: errBody(401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.', 'ACCESS_TOKEN_TYPE_UNSUPPORTED'),
      expectText: 'erişim belirteci',
    },
    {
      status: 401,
      body: errBody(401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.', 'CREDENTIALS_MISSING'),
      expectText: 'Kimlik doğrulanamadı (401 UNAUTHENTICATED)',
    },
    { status: 400, body: errBody(400, 'INVALID_ARGUMENT', 'API key not valid.', 'API_KEY_INVALID'), expectText: 'anahtarı geçersiz' },
    {
      status: 400,
      body: errBody(400, 'INVALID_ARGUMENT', "Invalid value at 'generation_config.response_format.text.mime_type'"),
      expectText: 'İstek reddedildi (400 INVALID_ARGUMENT)',
    },
    { status: 403, body: errBody(403, 'PERMISSION_DENIED', "Method doesn't allow unregistered callers"), expectText: 'Erişim reddedildi (403' },
    { status: 429, body: errBody(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded'), expectText: 'İstek sınırına takıldınız (429' },
    { status: 503, body: errBody(503, 'UNAVAILABLE', 'The model is overloaded'), expectText: 'geçici olarak kullanılamıyor (503' },
  ]

  for (const c of cases) {
    it(`${c.status} ${c.body.error.status}${c.body.error.details ? ' / ' + c.body.error.details[0].reason : ''}: Türkçe mesaj ve teşhis, anahtar yok`, () => {
      // Google mesajı anahtarı içerse bile hiçbir çıktıya sızmamalı.
      const leaky = { error: { ...c.body.error, message: `${c.body.error.message} (key=${FAKE_KEY})` } }
      const text = describeGeminiHttpError(c.status, leaky, FAKE_KEY)
      expect(text).toContain(c.expectText)
      const d = buildGeminiDiagnostics({
        httpStatus: c.status,
        body: leaky,
        endpointPath: '/v1beta/models/gemini-3.8-flash',
        model: 'gemini-3.8-flash',
        apiKey: FAKE_KEY,
      })
      expect(d).toMatchObject({ httpStatus: c.status, status: c.body.error.status, endpointPath: '/v1beta/models/gemini-3.8-flash' })
      expect(d.reason).toBe(c.body.error.details?.[0].reason ?? null)
      const everything = JSON.stringify({ text, d, rows: diagnosticsRows(d) })
      expect(everything).not.toContain(FAKE_KEY)
      expect(everything).not.toContain('TEST-ONLY-dummy')
    })
  }

  it('anahtar biçimi yalnızca kaba sınıf ve uzunluk olarak gösterilir', () => {
    expect(keyShape('AIzaTEST-ONLY-placeholder')).toBe('AIza önekli')
    expect(keyShape(FAKE_KEY)).toBe('AQ. önekli')
    expect(keyShape('TEST-ONLY-placeholder')).toBe('diğer biçim')
    const d = buildGeminiDiagnostics({ httpStatus: 401, body: null, endpointPath: '/p', model: 'm', apiKey: FAKE_KEY })
    expect(diagnosticsRows(d)).toContainEqual(['Anahtar biçimi', `AQ. önekli, ${FAKE_KEY.length} karakter`])
  })
})
