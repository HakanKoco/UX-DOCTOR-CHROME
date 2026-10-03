// Tutarlılık testi istatistikleri (saf fonksiyonlar, birim testli).
import { round1 } from './score'

export interface SeriesStats {
  /** Skoru hesaplanabilen çalıştırma sayısı (null skorlar hariç). */
  n: number
  mean: number | null
  /** Örneklem standart sapması (n − 1 ile); n < 2 ise null. */
  std: number | null
  min: number | null
  max: number | null
  /** max − min */
  range: number | null
}

export function seriesStats(values: readonly (number | null)[]): SeriesStats {
  const xs = values.filter((v): v is number => v !== null && Number.isFinite(v))
  const n = xs.length
  if (n === 0) return { n, mean: null, std: null, min: null, max: null, range: null }
  const mean = xs.reduce((s, x) => s + x, 0) / n
  const std = n < 2 ? null : Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1))
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  return { n, mean: round1(mean), std: std === null ? null : round1(std), min, max, range: round1(max - min) }
}

export interface AnswerAgreement {
  questionId: string
  answers: string[]
  /** En sık cevabın oranı (1 = tüm çalıştırmalarda aynı cevap). */
  agreement: number
  modeAnswer: string
}

/** Soru başına çalıştırmalar arası cevap uyumu: sapmanın nedenini bulmaya yardım eder. */
export function answerAgreement(runs: readonly { questionId: string; answer: string }[][]): AnswerAgreement[] {
  const ids = [...new Set(runs.flatMap((r) => r.map((a) => a.questionId)))]
  return ids.map((questionId) => {
    const answers = runs.map((r) => r.find((a) => a.questionId === questionId)?.answer ?? 'cevapsız')
    const counts = new Map<string, number>()
    for (const a of answers) counts.set(a, (counts.get(a) ?? 0) + 1)
    let modeAnswer = answers[0]
    let best = 0
    for (const [a, c] of counts) {
      if (c > best) {
        best = c
        modeAnswer = a
      }
    }
    return { questionId, answers, agreement: answers.length ? Math.round((best / answers.length) * 1000) / 1000 : 0, modeAnswer }
  })
}

/** Ödevdeki eşik: LLM skorlarının sapması 10 puandan fazlaysa neden ve çözüm açıklanmalı. */
export const DEVIATION_THRESHOLD = 10
