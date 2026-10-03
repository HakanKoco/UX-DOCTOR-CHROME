import { describe, expect, it } from 'vitest'
import { answerAgreement, seriesStats } from './stats'

describe('seriesStats', () => {
  it('ortalama, örneklem std, min, max ve aralık', () => {
    // 60, 70, 80 → ortalama 70, std = sqrt(((-10)²+0+10²)/2) = 10
    expect(seriesStats([60, 70, 80])).toEqual({ n: 3, mean: 70, std: 10, min: 60, max: 80, range: 20 })
  })
  it('null değerleri dışarıda bırakır', () => {
    expect(seriesStats([50, null, 50])).toEqual({ n: 2, mean: 50, std: 0, min: 50, max: 50, range: 0 })
  })
  it('tek değerde std null', () => {
    expect(seriesStats([42]).std).toBeNull()
  })
  it('boş seride her şey null', () => {
    expect(seriesStats([])).toEqual({ n: 0, mean: null, std: null, min: null, max: null, range: null })
  })
})

describe('answerAgreement', () => {
  it('soru başına en sık cevabın oranını verir', () => {
    const r = answerAgreement([
      [
        { questionId: 'V1', answer: 'evet' },
        { questionId: 'V2', answer: 'hayir' },
      ],
      [
        { questionId: 'V1', answer: 'evet' },
        { questionId: 'V2', answer: 'belirsiz' },
      ],
      [{ questionId: 'V1', answer: 'evet' }],
    ])
    expect(r[0]).toEqual({ questionId: 'V1', answers: ['evet', 'evet', 'evet'], agreement: 1, modeAnswer: 'evet' })
    expect(r[1].answers).toEqual(['hayir', 'belirsiz', 'cevapsız'])
    expect(r[1].agreement).toBeCloseTo(0.333, 3)
  })
})
