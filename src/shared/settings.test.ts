import { describe, expect, it } from 'vitest'
import { looksLikeApiKey, normalizeApiKey } from './settings'

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

describe('normalizeApiKey', () => {
  it('baştaki/sondaki boşluk, satır sonu, sıfır genişlikli boşluk ve BOM kırpılır; içerik değişmez', () => {
    const k = 'TEST-ONLY-placeholder-000'
    expect(normalizeApiKey('  ' + k + '\r\n')).toBe(k)
    expect(normalizeApiKey(String.fromCharCode(0xfeff) + k + String.fromCharCode(0x200b))).toBe(k) // BOM + sıfır genişlikli boşluk
    expect(normalizeApiKey('\t' + k + '\n\n')).toBe(k)
    expect(normalizeApiKey(k)).toBe(k)
  })
})
