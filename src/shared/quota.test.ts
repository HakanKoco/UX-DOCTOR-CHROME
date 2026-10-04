import { describe, expect, it } from 'vitest'
import {
  buildGeminiDiagnostics,
  classifyQuota,
  describeGeminiHttpError,
  diagnosticsRows,
  formatTurkeyTime,
  nextPacificMidnight,
  parseDurationMs,
  parseQuotaInfo,
} from './geminiResponse'
import { MAX_RETRIES, MAX_SERVER_RETRY_DELAY_MS, retryDecision } from './retry'

// 429 gövdeleri google/rpc/error_details.proto (QuotaFailure, RetryInfo) ve ProtoJSON kurallarına göre KURGULANMIŞTIR.
// Gemini dokümanı gerçek quotaId adlarını yayımlamadığı için quotaId değerleri örnek dizelerdir; gerçek ölçüm değildir.

const FAKE_KEY = 'AIza-TEST-ONLY-placeholder-not-a-real-key-000000'

type Violation = { quotaId?: string; quotaMetric?: string; quotaValue?: string }

function body429(violations: Violation[], retryDelay?: string, message = 'Quota exceeded') {
  return {
    error: {
      code: 429,
      message,
      status: 'RESOURCE_EXHAUSTED',
      details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations },
        ...(retryDelay ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] : []),
      ],
    },
  }
}

const RPM_V: Violation = {
  quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
  quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
  quotaValue: '10',
}
const TPM_V: Violation = {
  quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_input_token_count',
  quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier',
  quotaValue: '250000',
}
const RPD_V: Violation = {
  quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
  quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
  quotaValue: '250',
}
const RPM = body429([RPM_V], '38s')
const TPM = body429([TPM_V], '12.500s')
const RPD = body429([RPD_V], '3600s')

describe('parseDurationMs (ProtoJSON Duration)', () => {
  it('"38s", "12.500s" ve geçersiz değerler', () => {
    expect(parseDurationMs('38s')).toBe(38_000)
    expect(parseDurationMs('12.500s')).toBe(12_500)
    expect(parseDurationMs('0.000340012s')).toBe(0)
    expect(parseDurationMs('38')).toBeNull()
    expect(parseDurationMs(38)).toBeNull()
  })
})

describe('parseQuotaInfo — 429 kota ayrıntısı', () => {
  it('dakikalık istek (RPM) + RetryInfo', () => {
    expect(parseQuotaInfo(RPM)).toEqual({
      kind: 'rpm',
      quotaId: RPM_V.quotaId,
      quotaMetric: RPM_V.quotaMetric,
      quotaValue: '10',
      retryDelayMs: 38_000,
    })
  })
  it('dakikalık token (TPM)', () => {
    expect(parseQuotaInfo(TPM)).toMatchObject({ kind: 'tpm', quotaValue: '250000', retryDelayMs: 12_500 })
  })
  it('günlük istek (RPD)', () => {
    expect(parseQuotaInfo(RPD)).toMatchObject({ kind: 'rpd', quotaValue: '250' })
  })
  it('birden çok ihlalde en kısıtlayıcısı (günlük) seçilir', () => {
    expect(parseQuotaInfo(body429([RPM_V, RPD_V], '30s'))?.kind).toBe('rpd')
  })
  it('kalıp tanınmazsa "unknown" (tahmin yok); ayrıntı hiç yoksa null', () => {
    expect(parseQuotaInfo(body429([{ quotaId: 'XyzLimit' }]))?.kind).toBe('unknown')
    expect(parseQuotaInfo({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'x' } })).toBeNull()
    expect(parseQuotaInfo(null)).toBeNull()
  })
  it('yalnızca RetryInfo varsa tür bilinmez ama bekleme alınır', () => {
    const only = { error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '5s' }] } }
    expect(parseQuotaInfo(only)).toEqual({ kind: 'unknown', quotaId: null, quotaMetric: null, quotaValue: null, retryDelayMs: 5000 })
  })
  it('günlük token sınırı da "günlük" sayılır', () => {
    expect(classifyQuota('GenerateContentInputTokensPerModelPerDay-FreeTier', null)).toBe('rpd')
  })
})

describe('günlük kota sıfırlanma saati (Pasifik gece yarısı → Türkiye)', () => {
  it('yaz saati (PDT): Türkiye saatiyle 10:00', () => {
    const reset = nextPacificMidnight(Date.parse('2026-10-04T12:00:00Z'))
    expect(new Date(reset).toISOString()).toBe('2026-10-05T07:00:00.000Z')
    expect(formatTurkeyTime(reset)).toMatch(/10:00/)
  })
  it('kış saati (PST): Türkiye saatiyle 11:00', () => {
    const reset = nextPacificMidnight(Date.parse('2026-12-01T12:00:00Z'))
    expect(new Date(reset).toISOString()).toBe('2026-12-02T08:00:00.000Z')
    expect(formatTurkeyTime(reset)).toMatch(/11:00/)
  })
  it('Pasifik gece yarısından hemen önce: bir dakika sonraki sıfırlanma', () => {
    expect(new Date(nextPacificMidnight(Date.parse('2026-10-05T06:59:00Z'))).toISOString()).toBe('2026-10-05T07:00:00.000Z')
  })
})

describe('429 Türkçe teşhis ve anahtar güvenliği', () => {
  it("RPM: tür ve Google'ın önerdiği bekleme yazılır", () => {
    const text = describeGeminiHttpError(429, RPM, FAKE_KEY)
    expect(text).toContain('Dakikalık istek kotası (RPM) doldu (sınır: 10)')
    expect(text).toContain('38 sn')
  })
  it('TPM', () => {
    expect(describeGeminiHttpError(429, TPM, FAKE_KEY)).toContain('Dakikalık token kotası (TPM) doldu')
  })
  it('RPD: yeniden denenmeyeceği ve Türkiye saatiyle sıfırlanma yazılır', () => {
    const text = describeGeminiHttpError(429, RPD, FAKE_KEY)
    expect(text).toContain('Günlük ücretsiz kota doldu')
    expect(text).toContain('Türkiye saatiyle')
    expect(text).toContain('Yeniden denenmeyecek')
  })
  it('ayrıntısız 429: AI Studio yönlendirmesi', () => {
    expect(describeGeminiHttpError(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } })).toContain(
      'aistudio.google.com/rate-limit',
    )
  })
  it('anahtar hiçbir çıktıda yok (mesaj, teşhis, teşhis satırları)', () => {
    const leaky = body429([RPM_V], '38s', `Quota exceeded for key ${FAKE_KEY}`)
    const d = buildGeminiDiagnostics({
      httpStatus: 429,
      body: leaky,
      endpointPath: '/v1beta/models/gemini-3.8-flash:generateContent',
      model: 'gemini-3.8-flash',
      apiKey: FAKE_KEY,
    })
    expect(d.quota?.kind).toBe('rpm')
    const all = JSON.stringify([describeGeminiHttpError(429, leaky, FAKE_KEY), d, diagnosticsRows(d)])
    expect(all).not.toContain(FAKE_KEY)
    expect(all).not.toContain('TEST-ONLY-placeholder')
    expect(diagnosticsRows(d)).toContainEqual(['Kota türü', 'dakikalık istek kotası (RPM)'])
  })
  it('429 dışındaki durumlarda kota ayrıntısı yazılmaz', () => {
    expect(buildGeminiDiagnostics({ httpStatus: 503, body: RPM, endpointPath: '/', model: 'm' }).quota).toBeNull()
  })
})

describe('retryDecision — kota türüne göre yeniden deneme', () => {
  const r0 = () => 0
  it('günlük kota: hiç denenmez (boşuna istek harcanmaz)', () => {
    expect(retryDecision(429, parseQuotaInfo(RPD), 0, r0)).toEqual({ retry: false, reason: 'daily-quota' })
  })
  it("dakikalık kota: Google'ın retryDelay değeri kullanılır", () => {
    expect(retryDecision(429, parseQuotaInfo(RPM), 0, r0)).toEqual({ retry: true, delayMs: 38_000, basis: 'server' })
    expect(retryDecision(429, parseQuotaInfo(TPM), 2, r0)).toEqual({ retry: true, delayMs: 12_500, basis: 'server' })
  })
  it('retryDelay yoksa üstel bekleme; 503 her zaman üstel', () => {
    expect(retryDecision(429, null, 0, r0)).toEqual({ retry: true, delayMs: 5000, basis: 'exponential' })
    expect(retryDecision(503, parseQuotaInfo(RPM), 1, r0)).toEqual({ retry: true, delayMs: 10_000, basis: 'exponential' })
  })
  it('çok uzun önerilen bekleme ve tükenen denemeler: durulur', () => {
    expect(retryDecision(429, { kind: 'rpm', retryDelayMs: MAX_SERVER_RETRY_DELAY_MS + 1 }, 0, r0)).toEqual({
      retry: false,
      reason: 'delay-too-long',
    })
    expect(retryDecision(429, parseQuotaInfo(RPM), MAX_RETRIES, r0)).toEqual({ retry: false, reason: 'exhausted' })
    expect(retryDecision(400, null, 0, r0)).toEqual({ retry: false, reason: 'not-retryable' })
  })
})
