import { describe, expect, it } from 'vitest'
import { LlmResponseError, evaluateAnswers, looksNonTurkish, normalizeEvidenceId, parseLlmResponse } from './llmValidate'
import { RUBRIC } from './rubric'
import { sampleInventory } from './testFixtures'

// 8. madde: kurgusal (uydurma) model yanıtlarıyla ayrıştırıcı ve doğrulayıcının sağlamlığı.
// Hiçbiri gerçek bir model çıktısı ya da ölçüm değildir.

const ok = (over: Record<string, unknown> = {}) => ({
  questionId: 'V1',
  answer: 'hayir',
  evidenceIds: ['E2'],
  rationale: 'Birincil düğme ilk ekranda değil (aboveFold=false).',
  fix: 'Düğmeyi ilk ekrana taşıyın.',
  ...over,
})
const json = (answers: unknown[]) => JSON.stringify({ answers })

describe('parseLlmResponse — bozuk/eksik/fazla alanlı yanıtlar', () => {
  it('```json kod bloğu ve öndeki/sondaki metin temizlenir', () => {
    expect(parseLlmResponse('```json\n' + json([ok()]) + '\n```').answers).toHaveLength(1)
    expect(parseLlmResponse('İşte değerlendirme:\n' + json([ok()]) + '\nUmarım yardımcı olur.').answers).toHaveLength(1)
  })

  it('JSON değilse Türkçe şema hatası', () => {
    expect(() => parseLlmResponse('Üzgünüm, bu sayfayı değerlendiremem.')).toThrow(LlmResponseError)
    expect(() => parseLlmResponse('{bozuk')).toThrow(/Model yanıtı beklenen şemaya uymadı; tekrar deneyin/)
  })

  it('"answers" yoksa ya da dizi değilse Türkçe şema hatası', () => {
    expect(() => parseLlmResponse('{"cevaplar": []}')).toThrow(/"answers" dizisi yok/)
    expect(() => parseLlmResponse('{"answers": "yok"}')).toThrow(LlmResponseError)
    expect(() => parseLlmResponse('[1,2]')).toThrow(/JSON nesnesi değil/)
  })

  it('fazladan alanlar yok sayılır', () => {
    const r = parseLlmResponse(JSON.stringify({ answers: [ok({ score: 87, confidence: 'high' })], meta: { x: 1 } }))
    expect(r.answers[0]).toEqual({
      questionId: 'V1',
      answer: 'hayir',
      evidenceIds: ['E2'],
      rationale: 'Birincil düğme ilk ekranda değil (aboveFold=false).',
      fix: 'Düğmeyi ilk ekrana taşıyın.',
    })
  })

  it('eksik isteğe bağlı alanlar boş değer alır', () => {
    const r = parseLlmResponse(json([{ questionId: 'V2', answer: 'evet' }]))
    expect(r.answers[0]).toEqual({ questionId: 'V2', answer: 'evet', evidenceIds: [], rationale: '', fix: '' })
  })

  it('tek bozuk cevap tüm yanıtı düşürmez: atlanır ve sayılır', () => {
    const r = parseLlmResponse(json([ok(), { questionId: 'V2', answer: 'belki' }, { answer: 'evet' }, null, ok({ questionId: 'V3' })]))
    expect(r.answers.map((a) => a.questionId)).toEqual(['V1', 'V3'])
    expect(r.malformed).toBe(3)
  })

  it('hiçbir cevap şemaya uymuyorsa şema hatası', () => {
    expect(() => parseLlmResponse(json([{ questionId: 'V1', answer: 'belki' }]))).toThrow(/hiçbir cevap/)
  })

  it('"Hayır", " EVET " yazımları şemadaki değere çevrilir', () => {
    const r = parseLlmResponse(json([ok({ answer: 'Hayır' }), ok({ questionId: 'V2', answer: ' EVET ' })]))
    expect(r.answers.map((a) => a.answer)).toEqual(['hayir', 'evet'])
  })

  it('boş cevap dizisi: hata değil; bütün sorular cevapsız sayılır, bulgu ve skor yok', () => {
    const r = parseLlmResponse(json([]))
    expect(r).toEqual({ answers: [], malformed: 0 })
    const ev = evaluateAnswers(r.answers, sampleInventory())
    expect(ev.findings).toEqual([])
    expect(ev.missingQuestionIds).toHaveLength(RUBRIC.length)
  })
})

describe('kimlik doğrulama — envanterde olmayan atıflar halüsinasyon', () => {
  it('envanterde olmayan kimlik düşülür ve sayılır; geçerli kanıtı kalmayan bulgu düşer', () => {
    const parsed = parseLlmResponse(json([ok({ evidenceIds: ['E99'] }), ok({ questionId: 'V2', evidenceIds: ['E2', 'E77'] })]))
    const ev = evaluateAnswers(parsed.answers, sampleInventory(), parsed.malformed)
    expect(ev.findings.map((f) => f.ruleId)).toEqual(['V2'])
    expect(ev.hallucination).toMatchObject({
      totalReferences: 3,
      invalidReferences: 2,
      droppedFindings: 1,
      invalidIds: ['E99', 'E77'],
    })
    expect(ev.answers.find((a) => a.questionId === 'V1')).toMatchObject({ effectiveAnswer: 'belirsiz', invalidEvidenceIds: ['E99'] })
  })

  it('kimlik yalnızca boşluk/büyük harf açısından normalleşir; "E2." gibi biçimler halüsinasyon sayılır', () => {
    expect(normalizeEvidenceId(' e2 ')).toBe('E2')
    expect(normalizeEvidenceId('sayfa')).toBe('SAYFA')
    const parsed = parseLlmResponse(json([ok({ evidenceIds: [' e2 '] }), ok({ questionId: 'V2', evidenceIds: ['E2.'] })]))
    const ev = evaluateAnswers(parsed.answers, sampleInventory())
    expect(ev.findings.map((f) => f.ruleId)).toEqual(['V1'])
    expect(ev.hallucination.invalidIds).toEqual(['E2.'])
  })

  it('yinelenen ve rubrikte olmayan sorular ile bozuk cevaplar yok sayılan cevap olarak sayılır', () => {
    const parsed = parseLlmResponse(json([ok(), ok(), ok({ questionId: 'Z9' }), { questionId: 'V2', answer: 1 }]))
    const ev = evaluateAnswers(parsed.answers, sampleInventory(), parsed.malformed)
    expect(ev.malformedAnswers).toBe(1)
    expect(ev.ignoredAnswers).toBe(3)
  })
})

describe('LLM bulgu metni — Türkçe, somut, envanter kimlikli', () => {
  it('açıklama envanter kimliği ve öğenin Türkçe tanımıyla başlar', () => {
    const ev = evaluateAnswers(parseLlmResponse(json([ok()])).answers, sampleInventory())
    expect(ev.findings[0].description).toMatch(/^E2 · düğme "Randevu al" \(<button>\) — /)
    expect(ev.findings[0].description).toContain('→ Hayır.')
    expect(ev.findings[0].elementId).toBe('E2')
  })

  it('öğe adındaki kişisel veri bulgu metninde maskelenir', () => {
    const ev = evaluateAnswers(parseLlmResponse(json([ok({ questionId: 'M1', evidenceIds: ['E3'] })])).answers, sampleInventory())
    expect(ev.findings[0].description).toContain('[TC]')
    expect(ev.findings[0].description).not.toContain('12345678901')
  })

  it('model öneri yazmadıysa öğeye ve soruya özel Türkçe yedek öneri üretilir', () => {
    const ev = evaluateAnswers(parseLlmResponse(json([ok({ fix: '' })])).answers, sampleInventory())
    expect(ev.findings[0].fix).toContain('E2 · düğme "Randevu al"')
    expect(ev.findings[0].fix).toContain('"evet" denebilecek şekilde')
  })

  it('sayfa düzeyi kanıt "Sayfa geneli" olarak yazılır', () => {
    const ev = evaluateAnswers(parseLlmResponse(json([ok({ evidenceIds: ['SAYFA'] })])).answers, sampleInventory())
    expect(ev.findings[0].description.startsWith('Sayfa geneli — ')).toBe(true)
  })

  it('İngilizce gerekçe/öneri işaretlenir (ham yanıt çalıştırma kaydında kalır)', () => {
    expect(looksNonTurkish('The primary button is missing from the first screen.')).toBe(true)
    expect(looksNonTurkish('Birincil düğme ilk ekranda değil.')).toBe(false)
    const ev = evaluateAnswers(
      parseLlmResponse(json([ok({ rationale: 'The button is not visible.', fix: 'Move the button up.' })])).answers,
      sampleInventory(),
    )
    expect(ev.findings[0].description).toContain('Türkçe yazmadı')
    expect(ev.findings[0].fix).toContain('Türkçe yazmadı')
  })
})
