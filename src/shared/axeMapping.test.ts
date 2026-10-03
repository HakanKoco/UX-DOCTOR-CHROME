import { describe, expect, it } from 'vitest'
import { categoryForRule, severityFromImpact, stripValueAttributes, wcagLabelFromTags } from './axeMapping'
import { sanitizeEvidenceHtml } from './sanitize'

describe('wcagLabelFromTags', () => {
  it('başarı ölçütü etiketini numaraya çevirir', () => {
    expect(wcagLabelFromTags(['cat.color', 'wcag2aa', 'wcag143'])).toBe('WCAG 1.4.3')
    expect(wcagLabelFromTags(['wcag22aa', 'wcag258'])).toBe('WCAG 2.5.8')
    expect(wcagLabelFromTags(['wcag2aa', 'wcag1410'])).toBe('WCAG 1.4.10')
  })
  it('birden çok ölçütü yazar, düzey etiketlerini yok sayar', () => {
    expect(wcagLabelFromTags(['wcag2a', 'wcag111', 'wcag412'])).toBe('WCAG 1.1.1, 4.1.2')
  })
  it('ölçüt yoksa yalnızca WCAG döner', () => {
    expect(wcagLabelFromTags(['wcag2a', 'best-practice'])).toBe('WCAG')
  })
})

describe('categoryForRule', () => {
  it('çekirdek kuralları kategorilere eşler', () => {
    expect(categoryForRule('color-contrast')).toBe('contrast')
    expect(categoryForRule('image-alt')).toBe('text-alternatives')
    expect(categoryForRule('label')).toBe('form-labels')
    expect(categoryForRule('target-size')).toBe('target-size')
    expect(categoryForRule('html-has-lang')).toBe('language')
  })
  it('diğer kuralları "other-wcag" sayar', () => {
    expect(categoryForRule('link-name')).toBe('other-wcag')
  })
})

describe('severityFromImpact', () => {
  it('axe etkisini şiddete eşler', () => {
    expect(severityFromImpact('critical')).toBe('Kritik')
    expect(severityFromImpact('serious')).toBe('Yüksek')
    expect(severityFromImpact('moderate')).toBe('Orta')
    expect(severityFromImpact('minor')).toBe('Düşük')
    expect(severityFromImpact(null)).toBe('Orta')
  })
})

describe('stripValueAttributes + sanitizeEvidenceHtml', () => {
  it('value attribute değerlerini gizler', () => {
    expect(stripValueAttributes('<input type="text" value="Ahmet Yılmaz" name="ad">')).toBe(
      '<input type="text" value="[gizlendi]" name="ad">',
    )
    expect(stripValueAttributes("<input value='x' >")).toBe('<input value="[gizlendi]" >')
    expect(stripValueAttributes('<input value=abc>')).toBe('<input value="[gizlendi]">')
  })
  it('textarea içeriğini gizler (kesilmiş parçada bile)', () => {
    expect(stripValueAttributes('<textarea name="not">Gizli not</textarea>')).toBe(
      '<textarea name="not">[gizlendi]</textarea>',
    )
    expect(stripValueAttributes('<textarea name="not">Gizli not uzun')).toBe('<textarea name="not">[gizlendi]')
  })
  it('kanıt HTML parçasındaki kişisel verileri maskeler', () => {
    expect(sanitizeEvidenceHtml('<p>Tel: 0532 123 45 67, e-posta: a@b.com</p>')).toBe(
      '<p>Tel: [TELEFON], e-posta: [E-POSTA]</p>',
    )
  })
})
