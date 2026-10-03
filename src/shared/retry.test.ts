import { describe, expect, it } from 'vitest'
import { MAX_RETRIES, RETRY_MAX_DELAY_MS, RUN_INTERVAL_MS, isRetryableStatus, retryDelayMs, shouldRetry } from './retry'

describe('isRetryableStatus', () => {
  it('yalnızca geçici hatalar yeniden denenir', () => {
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(529)).toBe(true)
    for (const s of [400, 401, 403, 404, 500, undefined]) expect(isRetryableStatus(s)).toBe(false)
  })
})

describe('retryDelayMs', () => {
  it('üstel artar: 2s, 4s, 8s, 16s (sapma 0 iken)', () => {
    expect([1, 2, 3, 4].map((a) => retryDelayMs(a, () => 0))).toEqual([2000, 4000, 8000, 16000])
  })

  it('rastgele sapma en çok 1 sn ekler', () => {
    expect(retryDelayMs(1, () => 0.999)).toBe(2999)
  })

  it('üst sınır 60 sn', () => {
    expect(retryDelayMs(10, () => 0.5)).toBe(RETRY_MAX_DELAY_MS)
  })
})

describe('shouldRetry', () => {
  it(`en çok ${MAX_RETRIES} yeniden deneme yapılır`, () => {
    expect(shouldRetry(429, 0)).toBe(true)
    expect(shouldRetry(429, MAX_RETRIES - 1)).toBe(true)
    expect(shouldRetry(429, MAX_RETRIES)).toBe(false)
    expect(shouldRetry(400, 0)).toBe(false)
  })
})

describe('RUN_INTERVAL_MS', () => {
  it('Gemini çalıştırmaları arasında 15 sn beklenir, Claude davranışı değişmez', () => {
    expect(RUN_INTERVAL_MS.gemini).toBe(15000)
    expect(RUN_INTERVAL_MS.claude).toBe(0)
  })
})
