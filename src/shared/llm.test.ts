import { describe, expect, it } from 'vitest'
import {
  FALLBACK_BETA,
  MAX_TOKENS,
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  buildClaudeRequestBody,
  buildGeminiRequestBody,
  buildLlmRequest,
  requestParameters,
  requestTransportPreview,
  requiredBetas,
} from './llmRequest'
import { LlmResponseError, evaluateAnswers, parseLlmResponse, type RawAnswer } from './llmValidate'
import { RUBRIC } from './rubric'
import { sampleInventory } from './testFixtures'

describe('buildClaudeRequestBody', () => {
  it('Opus 5.5: effort sabit, temperature yok, sunucu yedeği açık', () => {
    const body = buildClaudeRequestBody('claude-opus-5-5', sampleInventory())
    expect(body.model).toBe('claude-opus-5-5')
    expect(body.output_config.effort).toBe('medium')
    expect(body.temperature).toBeUndefined()
    expect(body.fallbacks).toBe('default')
    expect(requiredBetas(body)).toEqual([FALLBACK_BETA])
  })

  it('Haiku 4.5: temperature 0, effort ve yedek yok', () => {
    const body = buildClaudeRequestBody('claude-haiku-4-5', sampleInventory())
    expect(body.temperature).toBe(0)
    expect(body.output_config.effort).toBeUndefined()
    expect(body.fallbacks).toBeUndefined()
    expect(requiredBetas(body)).toEqual([])
  })

  it('yapılandırılmış çıktı şeması gönderilir', () => {
    const body = buildClaudeRequestBody('claude-sonnet-5-5', sampleInventory())
    expect(body.output_config.format).toEqual({ type: 'json_schema', schema: RESPONSE_SCHEMA })
  })

  it('kullanıcı mesajındaki envanter maskelenmiştir; ekran görüntüsü yoktur', () => {
    const body = buildClaudeRequestBody('claude-opus-5-5', sampleInventory())
    const content = body.messages[0].content
    expect(content).not.toContain('12345678901')
    expect(content).not.toContain('0532 123 45 67')
    expect(content).not.toContain('iletisim@ornek.test')
    expect(content).toContain('[TC]')
    expect(content).toContain('[TELEFON]')
    expect(content).toContain('[E-POSTA]')
    // İçerik tek bir metin bloğudur: görüntü bloğu ya da gömülü görüntü verisi yoktur.
    expect(typeof content).toBe('string')
    expect(content).not.toMatch(/data:image|base64,/i)
  })

  it('aynı girdiyle aynı gövdeyi üretir (tekrarlanabilirlik)', () => {
    expect(JSON.stringify(buildClaudeRequestBody('claude-opus-5-5', sampleInventory()))).toBe(
      JSON.stringify(buildClaudeRequestBody('claude-opus-5-5', sampleInventory())),
    )
  })

  it('rubrik her ilke için 4-6 soru içerir', () => {
    const counts: Record<string, number> = {}
    for (const q of RUBRIC) counts[q.principle] = (counts[q.principle] ?? 0) + 1
    expect(Object.keys(counts)).toHaveLength(6)
    for (const n of Object.values(counts)) {
      expect(n).toBeGreaterThanOrEqual(4)
      expect(n).toBeLessThanOrEqual(6)
    }
  })
})

describe('parseLlmResponse', () => {
  it('geçersiz JSON reddedilir', () => {
    expect(() => parseLlmResponse('{oops')).toThrow(LlmResponseError)
  })
  it('answers dizisi yoksa reddedilir', () => {
    expect(() => parseLlmResponse('{"x":1}')).toThrow(LlmResponseError)
  })
  it('şemaya uymayan cevap reddedilir', () => {
    expect(() => parseLlmResponse('{"answers":[{"questionId":"V1","answer":"belki"}]}')).toThrow(LlmResponseError)
  })
})

function answer(questionId: string, a: RawAnswer['answer'], evidenceIds: string[] = [], fix = ''): RawAnswer {
  return { questionId, answer: a, evidenceIds, rationale: 'gerekçe', fix }
}

describe('evaluateAnswers — kimlik doğrulama ve halüsinasyon', () => {
  it('geçerli kanıtlı "hayir" bulgu üretir, seçici yerel envanterden gelir', () => {
    const r = evaluateAnswers([answer('M1', 'hayir', ['E3'], 'Alana label ekleyin.')], sampleInventory())
    expect(r.findings).toHaveLength(1)
    const f = r.findings[0]
    expect(f).toMatchObject({
      source: 'llm',
      selector: '#e3',
      elementId: 'E3',
      rule: 'Norman: Eşleme',
      severity: 'Yüksek',
      fix: 'Alana label ekleyin.',
    })
    expect(r.hallucination.invalidReferences).toBe(0)
  })

  it('envanterde olmayan kimlik halüsinasyon sayılır ve kanıttan düşülür', () => {
    const r = evaluateAnswers([answer('V4', 'hayir', ['E2', 'E99'])], sampleInventory())
    expect(r.hallucination).toMatchObject({ totalReferences: 2, invalidReferences: 1, invalidIds: ['E99'], invalidReferenceRate: 0.5 })
    expect(r.answers[0].evidenceIds).toEqual(['E2'])
    expect(r.answers[0].invalidEvidenceIds).toEqual(['E99'])
    expect(r.findings).toHaveLength(1)
  })

  it('tüm kanıtı geçersiz "hayir" bulgudan düşülür, skorda belirsiz sayılır', () => {
    const r = evaluateAnswers([answer('V4', 'hayir', ['E77'])], sampleInventory())
    expect(r.findings).toHaveLength(0)
    expect(r.answers[0].effectiveAnswer).toBe('belirsiz')
    expect(r.hallucination.droppedFindings).toBe(1)
  })

  it('hiç kanıtı olmayan "hayir" halüsinasyon değil ama bulgu da değildir', () => {
    const r = evaluateAnswers([answer('V4', 'hayir', [])], sampleInventory())
    expect(r.findings).toHaveLength(0)
    expect(r.answers[0].effectiveAnswer).toBe('belirsiz')
    expect(r.hallucination.evidencelessNegatives).toBe(1)
    expect(r.hallucination.droppedFindings).toBe(0)
  })

  it('SAYFA kimliği sayfa düzeyi kanıt olarak geçerlidir', () => {
    const r = evaluateAnswers([answer('F1', 'hayir', ['SAYFA'])], sampleInventory())
    expect(r.findings[0]).toMatchObject({ elementId: 'SAYFA', selector: 'body' })
    expect(r.hallucination.invalidReferences).toBe(0)
  })

  it('ek kanıt öğeleri relatedElements olarak eklenir', () => {
    const r = evaluateAnswers([answer('K2', 'hayir', ['E2', 'E4'])], sampleInventory())
    expect(r.findings[0].evidence.relatedElements).toEqual([{ elementId: 'E4', selector: '#e4' }])
  })

  it('cevapsız sorular listelenir; tekrar eden ve bilinmeyen cevaplar yok sayılır', () => {
    const r = evaluateAnswers([answer('V1', 'evet'), answer('V1', 'hayir', ['E1']), answer('X9', 'evet')], sampleInventory())
    expect(r.answers).toHaveLength(1)
    expect(r.answers[0].effectiveAnswer).toBe('evet')
    expect(r.ignoredAnswers).toBe(2)
    expect(r.missingQuestionIds).toHaveLength(RUBRIC.length - 1)
  })
})

describe('buildGeminiRequestBody / buildLlmRequest (Gemini)', () => {
  it('temperature 1.0, thinkingLevel MEDIUM ve aynı JSON şeması gönderilir', () => {
    const body = buildGeminiRequestBody(sampleInventory())
    expect(body.generationConfig.temperature).toBe(1)
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' })
    expect(body.generationConfig.maxOutputTokens).toBe(MAX_TOKENS)
    expect(body.generationConfig.responseFormat).toEqual({ text: { mimeType: 'application/json', schema: RESPONSE_SCHEMA } })
  })

  it('Claude ile aynı sistem prompt ve kullanıcı mesajı gider', () => {
    const inv = sampleInventory()
    const gemini = buildGeminiRequestBody(inv)
    const claude = buildClaudeRequestBody('claude-opus-5-5', inv)
    expect(gemini.systemInstruction.parts[0].text).toBe(SYSTEM_PROMPT)
    expect(gemini.contents[0].parts[0].text).toBe(claude.messages[0].content)
  })

  it('kullanıcı mesajı maskelenmiştir; görüntü yoktur', () => {
    const body = buildGeminiRequestBody(sampleInventory())
    expect(body.contents).toHaveLength(1)
    expect(body.contents[0].parts).toHaveLength(1)
    const text = body.contents[0].parts[0].text
    expect(text).not.toContain('12345678901')
    expect(text).not.toContain('0532 123 45 67')
    expect(text).not.toContain('iletisim@ornek.test')
    expect(text).toContain('[TC]')
    expect(JSON.stringify(body)).not.toMatch(/data:image|base64,|inlineData/i)
  })

  it('model adı gövdede değil URL\'dedir; adreste ve başlık önizlemesinde anahtar yoktur', () => {
    const request = buildLlmRequest('gemini-3.8-flash', sampleInventory())
    expect(request.provider).toBe('gemini')
    expect(JSON.stringify(request.body)).not.toContain('gemini-3.8-flash')
    const t = requestTransportPreview(request)
    expect(t.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent')
    expect(t.url).not.toMatch(/[?&]key=/)
    expect(t.keyHeader).toBe('x-goog-api-key')
    expect(Object.keys(t.headers)).not.toContain('x-goog-api-key')
  })

  it('çalıştırma parametreleri gönderildiği haliyle çıkarılır', () => {
    expect(requestParameters(buildLlmRequest('gemini-3.5-flash-lite', sampleInventory()))).toEqual({
      maxTokens: MAX_TOKENS,
      temperature: 1,
      thinkingLevel: 'MEDIUM',
    })
    expect(requestParameters(buildLlmRequest('claude-haiku-4-5', sampleInventory()))).toEqual({
      maxTokens: MAX_TOKENS,
      temperature: 0,
    })
  })

  it('Claude isteğinde anahtar başlığı önizlemede yer almaz', () => {
    const t = requestTransportPreview(buildLlmRequest('claude-opus-5-5', sampleInventory()))
    expect(t.keyHeader).toBe('x-api-key')
    expect(t.headers['anthropic-beta']).toBe(FALLBACK_BETA)
    expect(Object.keys(t.headers)).not.toContain('x-api-key')
  })

  it('bilinmeyen model reddedilir', () => {
    expect(() => buildLlmRequest('gpt-x' as never, sampleInventory())).toThrow()
  })
})
