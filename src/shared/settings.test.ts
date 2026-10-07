import { describe, expect, it } from 'vitest'
import { GEMINI_TEMPERATURE, isGeminiTemperature } from './models'
import { keyStatus, looksLikeApiKey, normalizeApiKey } from './settings'

describe('isGeminiTemperature', () => {
  it('yalnızca 1.0 (varsayılan) ve 0 (deney) kabul edilir', () => {
    expect(GEMINI_TEMPERATURE).toBe(1)
    expect(isGeminiTemperature(1)).toBe(true)
    expect(isGeminiTemperature(0)).toBe(true)
    expect(isGeminiTemperature(0.5)).toBe(false)
    expect(isGeminiTemperature('0')).toBe(false)
    expect(isGeminiTemperature(undefined)).toBe(false)
  })
})

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

describe('keyStatus — durum daima seçili sağlayıcıya göre', () => {
  it('provider=gemini, Gemini anahtarı var, Claude anahtarı yok → "ayarlanmamış" çıkmaz', () => {
    const s = keyStatus({ provider: 'gemini', hasGeminiKey: true, hasClaudeKey: false })
    expect(s.ok).toBe(true)
    expect(s.text).toContain('Gemini API')
    expect(s.text).not.toContain('ayarlanmamış')
    expect(s.text).not.toContain('Claude')
  })

  it('provider=gemini, Gemini anahtarı yok, Claude anahtarı var → Gemini için "ayarlanmamış"', () => {
    const s = keyStatus({ provider: 'gemini', hasGeminiKey: false, hasClaudeKey: true })
    expect(s.ok).toBe(false)
    expect(s.text).toContain('Gemini API')
    expect(s.text).toContain('ayarlanmamış')
  })

  it('provider=claude, Claude anahtarı var, Gemini anahtarı yok → kayıtlı', () => {
    const s = keyStatus({ provider: 'claude', hasGeminiKey: false, hasClaudeKey: true })
    expect(s.ok).toBe(true)
    expect(s.text).toContain('Claude API')
  })
})
