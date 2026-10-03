import { describe, expect, it } from 'vitest'
import { maskDeep, maskText, maskTextWithCounts } from './masking'

// Not: Testlerdeki numaralar uydurma örneklerdir; gerçek kişilere ait değildir.

describe('maskText — TC kimlik no', () => {
  it('11 haneli numarayı maskeler', () => {
    expect(maskText('TC: 12345678901')).toBe('TC: [TC]')
  })
  it('0 ile başlayan 11 haneyi TC saymaz (telefon olarak maskeler)', () => {
    expect(maskText('05321234567')).toBe('[TELEFON]')
  })
  it('10 ya da 12 haneli sayıyı TC saymaz', () => {
    expect(maskText('Sipariş 1234567890')).not.toContain('[TC]')
    expect(maskText('Kod 123456789012')).not.toContain('[TC]')
  })
})

describe('maskText — telefon', () => {
  it.each([
    ['0532 123 45 67'],
    ['0532-123-45-67'],
    ['(0212) 555 12 34'],
    ['+90 532 123 45 67'],
    ['+905321234567'],
    ['532 123 45 67'],
    ['0090 312 444 55 66'],
  ])('%s maskelenir', (phone) => {
    const out = maskText(`Bizi ${phone} numarasından arayın`)
    expect(out).toContain('[TELEFON]')
    expect(out).not.toMatch(/\d{3}/)
  })
  it('yabancı numarayı maskeler', () => {
    expect(maskText('Tel: +44 20 7946 0958')).toContain('[TELEFON]')
  })
  it('tarih ve fiyatları maskelemez', () => {
    expect(maskText('03.10.2026 tarihinde 1.299,99 TL')).toBe('03.10.2026 tarihinde 1.299,99 TL')
  })
})

describe('maskText — e-posta', () => {
  it('e-posta adresini maskeler', () => {
    expect(maskText('Yazın: ali.veli+test@ornek.com.tr')).toBe('Yazın: [E-POSTA]')
  })
  it('büyük harfli adresi maskeler', () => {
    expect(maskText('AYSE@ORNEK.COM')).toBe('[E-POSTA]')
  })
})

describe('maskText — IBAN', () => {
  it('boşluklu TR IBAN', () => {
    expect(maskText('IBAN: TR33 0006 1005 1978 6457 8413 26')).toBe('IBAN: [IBAN]')
  })
  it('bitişik TR IBAN', () => {
    expect(maskText('TR330006100519786457841326')).toBe('[IBAN]')
  })
  it('yabancı IBAN', () => {
    expect(maskText('DE89 3704 0044 0532 0130 00')).toBe('[IBAN]')
  })
})

describe('maskText — kart numarası', () => {
  it.each([['4111 1111 1111 1111'], ['4111-1111-1111-1111'], ['4111111111111111'], ['378282246310005']])(
    '%s maskelenir',
    (card) => {
      expect(maskText(`Kart ${card}`)).toBe('Kart [KART]')
    },
  )
})

describe('maskText — karışık metin', () => {
  it('her türü sayar', () => {
    const { text, counts } = maskTextWithCounts(
      'Ad: Ali, TC 12345678901, tel 0532 123 45 67, e-posta a@b.co, IBAN TR330006100519786457841326, kart 4111 1111 1111 1111',
    )
    expect(text).toBe('Ad: Ali, TC [TC], tel [TELEFON], e-posta [E-POSTA], IBAN [IBAN], kart [KART]')
    expect(counts).toEqual({ TC: 1, TELEFON: 1, 'E-POSTA': 1, IBAN: 1, KART: 1 })
  })
  it('kişisel veri yoksa metni değiştirmez', () => {
    const plain = 'Randevu al — Kardiyoloji Polikliniği, 2. kat, oda 214'
    expect(maskText(plain)).toBe(plain)
  })
})

describe('maskDeep', () => {
  it('iç içe nesnedeki tüm metinleri maskeler, sayılara dokunmaz', () => {
    const input = { a: 'tel 0532 123 45 67', b: [{ c: 'x@y.com' }], n: 12345678901 }
    expect(maskDeep(input)).toEqual({ a: 'tel [TELEFON]', b: [{ c: '[E-POSTA]' }], n: 12345678901 })
  })
})
