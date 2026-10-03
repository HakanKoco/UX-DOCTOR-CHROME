import { describe, expect, it } from 'vitest'
import { looksLikeApiKey } from './settings'

// Testlerde gerçek anahtar yoktur; değerler biçim denetimi için uydurulmuş yer tutuculardır.

describe('looksLikeApiKey', () => {
  it('Claude: "sk-ant-" öneki aranır', () => {
    expect(looksLikeApiKey('claude', 'sk-ant-TEST-ONLY-placeholder-000')).toBe(true)
    expect(looksLikeApiKey('claude', 'TEST-ONLY-placeholder-without-prefix')).toBe(false)
  })

  it('Gemini: önek aranmaz; boşluk ve çok kısa değer reddedilir', () => {
    expect(looksLikeApiKey('gemini', 'TEST-ONLY-placeholder-gemini-000')).toBe(true)
    expect(looksLikeApiKey('gemini', '  TEST-ONLY-placeholder-gemini-000  ')).toBe(true)
    expect(looksLikeApiKey('gemini', 'kisa')).toBe(false)
    expect(looksLikeApiKey('gemini', 'TEST ONLY placeholder with spaces')).toBe(false)
  })
})
