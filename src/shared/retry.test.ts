import { describe, expect, it } from 'vitest'
import {
  MAX_RETRIES,
  RETRY_MAX_DELAY_MS,
  RUN_INTERVAL_MS,
  isRetryableStatus,
  remainingSeconds,
  retryDelayMs,
  shouldRetry,
} from './retry'

describe('isRetryableStatus', () => {
  it('yalnızca geçici hatalar yeniden denenir', () => {
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(529)).toBe(true)
    for (const s of [400, 401, 403, 404, 500, undefined]) expect(isRetryableStatus(s)).toBe(false)
  })
})

describe('retryDelayMs', () => {
  it('üstel artar: 5s, 10s, 20s, 40s, 80s, 120s (sapma 0 iken)', () => {
    expect([1, 2, 3, 4, 5, 6].map((a) => retryDelayMs(a, () => 0))).toEqual([5000, 10000, 20000, 40000, 80000, 120000])
  })

  it('rastgele sapma en çok 1 sn ekler', () => {
    expect(retryDelayMs(1, () => 0.999)).toBe(5999)
  })

  it('üst sınır 120 sn', () => {
    expect(retryDelayMs(10, () => 0.5)).toBe(RETRY_MAX_DELAY_MS)
    expect(RETRY_MAX_DELAY_MS).toBe(120_000)
  })

  it('toplam bekleme en çok ≈ 4,6 dk (kullanıcıya görünür, iptal edilebilir)', () => {
    let total = 0
    for (let a = 1; a <= MAX_RETRIES; a++) total += retryDelayMs(a, () => 0.999)
    expect(total).toBeLessThan(5 * 60_000)
  })
})

describe('shouldRetry', () => {
  it(`en çok ${MAX_RETRIES} yeniden deneme yapılır`, () => {
    expect(MAX_RETRIES).toBe(6)
    expect(shouldRetry(503, 0)).toBe(true)
    expect(shouldRetry(503, MAX_RETRIES - 1)).toBe(true)
    expect(shouldRetry(503, MAX_RETRIES)).toBe(false)
    expect(shouldRetry(400, 0)).toBe(false)
  })
})

describe('remainingSeconds', () => {
  it('yukarı yuvarlar ve 0 altına inmez', () => {
    expect(remainingSeconds(10_500, 0)).toBe(11)
    expect(remainingSeconds(1_000, 1_000)).toBe(0)
    expect(remainingSeconds(0, 5_000)).toBe(0)
  })
})

describe('RUN_INTERVAL_MS', () => {
  it('Gemini çalıştırmaları arasında 15 sn beklenir, Claude davranışı değişmez', () => {
    expect(RUN_INTERVAL_MS.gemini).toBe(15000)
    expect(RUN_INTERVAL_MS.claude).toBe(0)
  })
})
