import { describe, expect, it } from 'vitest'
import {
  attemptedRuns,
  isComplete,
  isConsistencyProgress,
  newProgress,
  nextRunIndex,
  remainingRuns,
  samePage,
  withFailure,
  withPause,
  withResult,
} from './consistencyProgress'
import type { PageInfo } from './contentApi'
import { buildLlmRequest } from './llmRequest'
import { evaluateAnswers } from './llmValidate'
import type { LlmResult } from './report'
import { sampleInventory } from './testFixtures'
import { buildConsistencyExport } from './validationExports'

// Kurgulanmış birim testi girdileri; gerçek ölçüm değildir.

const page: PageInfo = {
  url: 'https://ornek.test/sayfa',
  host: 'ornek.test',
  title: 'Örnek',
  lang: 'tr',
  viewport: { width: 1, height: 1 },
  translation: { detected: false, reasons: [] },
}

function fakeResult(runId: string, model = 'gemini-3.8-flash'): LlmResult {
  return {
    run: {
      runId,
      timestamp: '2026-10-04T10:00:00.000Z',
      provider: 'gemini',
      requestedModel: model,
      servedModel: model,
      fallbackUsed: false,
      promptVersion: 'norman-rubrik-v1',
      parameters: { maxTokens: 16000, temperature: 1, thinkingLevel: 'MEDIUM' },
      retries: 0,
      stopReason: 'STOP',
      durationMs: 1,
      usage: null,
      rawResponse: '{}',
    },
    inventory: { includedCount: 4, candidateCount: 4, truncated: false, limit: 200 },
    ...evaluateAnswers([], sampleInventory()),
  }
}

function start(runs = 5) {
  const inventory = sampleInventory()
  return newProgress({
    page,
    request: buildLlmRequest('gemini-3.8-flash', inventory),
    inventory,
    requestedRuns: runs,
    now: '2026-10-04T10:00:00.000Z',
    testId: 't1',
  })
}

describe('tutarlılık testi ilerleme kaydı', () => {
  it('yeni kayıt: hiç çalıştırma yok, sıradaki 1', () => {
    const p = start(3)
    expect(attemptedRuns(p)).toBe(0)
    expect(nextRunIndex(p)).toBe(1)
    expect(remainingRuns(p)).toBe(3)
    expect(isComplete(p)).toBe(false)
  })

  it('503 ile duraklatılan test biten çalıştırmaları korur ve kaldığı yerden sürer', () => {
    let p = start(5)
    p = withResult(p, 1, fakeResult('r1'))
    p = withResult(p, 2, fakeResult('r2'))
    p = withPause(p, '503 UNAVAILABLE')
    expect(p.pausedReason).toBe('503 UNAVAILABLE')
    expect(p.results.map((r) => r.runIndex)).toEqual([1, 2])
    expect(nextRunIndex(p)).toBe(3)
    expect(remainingRuns(p)).toBe(3)
    // Devam: yeni sonuç duraklatma notunu siler.
    p = withResult(p, 3, fakeResult('r3'))
    expect(p.pausedReason).toBeUndefined()
    expect(nextRunIndex(p)).toBe(4)
  })

  it('duraklatma çalıştırma sayılmaz; kalıcı hata (şema) sayılır', () => {
    let p = start(3)
    p = withPause(p, 'iptal')
    expect(attemptedRuns(p)).toBe(0)
    p = withFailure(p, { runIndex: 1, timestamp: 't', error: 'şema hatası', rawResponse: 'x' })
    expect(attemptedRuns(p)).toBe(1)
    expect(p.failures[0].rawResponse).toBe('x')
  })

  it('tüm çalıştırmalar bitince tamamlanır', () => {
    let p = start(3)
    p = withResult(p, 1, fakeResult('r1'))
    p = withFailure(p, { runIndex: 2, timestamp: 't', error: 'e' })
    p = withResult(p, 3, fakeResult('r3'))
    expect(isComplete(p)).toBe(true)
    expect(remainingRuns(p)).toBe(0)
  })

  it('dışa aktarım yalnızca kayıttaki çalıştırmalardan kurulur (elle yedek model denemesi kayda hiç yazılmaz)', () => {
    let p = start(3)
    p = withResult(p, 1, fakeResult('r1'))
    const exp = buildConsistencyExport({ ...p, page: p.page })
    expect(exp.completedRuns).toBe(1)
    expect(exp.requestedRuns).toBe(3)
    expect(exp.runs.every((r) => r.requestedModel === 'gemini-3.8-flash')).toBe(true)
  })

  it('kayıt JSON gidiş-dönüşünden sonra geçerli sayılır; bozuk kayıt reddedilir', () => {
    const p = withResult(start(3), 1, fakeResult('r1'))
    expect(isConsistencyProgress(JSON.parse(JSON.stringify(p)))).toBe(true)
    expect(isConsistencyProgress(null)).toBe(false)
    expect(isConsistencyProgress({ ...p, version: 0 })).toBe(false)
    expect(isConsistencyProgress({ ...p, results: 'x' })).toBe(false)
  })

  it('kayıtta API anahtarı alanı yoktur', () => {
    const json = JSON.stringify(start(3))
    expect(json).not.toMatch(/x-goog-api-key|x-api-key|apiKey/i)
  })

  it('aynı sayfa karşılaştırması parçayı (#) yok sayar', () => {
    expect(samePage('https://a.test/x#ust', 'https://a.test/x')).toBe(true)
    expect(samePage('https://a.test/x', 'https://a.test/y')).toBe(false)
  })
})
