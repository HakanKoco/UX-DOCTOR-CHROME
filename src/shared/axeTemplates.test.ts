import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { AXE_FORCE_ENABLED_RULES, AXE_TAGS } from './axeMapping'
import {
  RULE_TEMPLATES,
  RULE_TITLES_TR,
  elementPhrase,
  fallbackRuleText,
  manualReviewDescription,
  ruleText,
  type RuleContext,
} from './axeTemplates'

const TURKISH = /[çğıöşüÇĞİÖŞÜ]/

/** Eklentinin çalıştırdığı kurallar: kurulu axe-core'daki WCAG 2.2 AA etiketli kurallar + açıkça açılanlar. */
const RULES = axe
  .getRules()
  .filter((r) => r.tags.some((t) => (AXE_TAGS as readonly string[]).includes(t)) || (AXE_FORCE_ENABLED_RULES as readonly string[]).includes(r.ruleId))

const ctx = (over: Partial<RuleContext> = {}): RuleContext => ({
  tag: 'div',
  role: null,
  name: '',
  wcag: 'WCAG 4.1.2',
  checks: {},
  ...over,
})

describe('Türkçe kural şablonları', () => {
  it('sık karşılaşılan en az 15 axe kuralının öğeye özel şablonu var', () => {
    const common = [
      'color-contrast', 'image-alt', 'label', 'button-name', 'link-name', 'target-size', 'html-has-lang',
      'html-lang-valid', 'aria-required-children', 'aria-required-parent', 'aria-allowed-attr',
      'aria-valid-attr-value', 'aria-hidden-focus', 'list', 'listitem', 'document-title', 'frame-title',
      'nested-interactive', 'select-name', 'scrollable-region-focusable',
    ]
    for (const id of common) expect(RULE_TEMPLATES[id], id).toBeTypeOf('function')
    expect(Object.keys(RULE_TEMPLATES).length).toBeGreaterThanOrEqual(15)
  })

  it(`kurulu axe-core ${axe.version}: eklentinin çalıştırdığı her kural için öneri boş değil, Türkçe ve axe'in İngilizce metnini içermiyor`, () => {
    expect(RULES.length).toBeGreaterThan(50)
    for (const r of RULES) {
      const t = ruleText(r.ruleId, ctx({ tag: 'button', role: 'button', name: 'Gönder' }))
      for (const field of [t.description, t.fix]) {
        expect(field.trim().length, r.ruleId).toBeGreaterThan(10)
        expect(field, r.ruleId).toMatch(TURKISH)
        expect(field, r.ruleId).not.toContain(r.help)
        expect(field, r.ruleId).not.toContain(r.description)
      }
      expect(RULE_TITLES_TR[r.ruleId], `${r.ruleId} için Türkçe başlık`).toBeTruthy()
    }
  })

  it('şablonsuz (bilinmeyen) kuralda Türkçe yedek metin çalışır', () => {
    const t = ruleText('kural-yok-xyz', ctx({ tag: 'a', role: 'link', name: 'Kampüs' }))
    expect(t).toEqual(fallbackRuleText('kural-yok-xyz', ctx({ tag: 'a', role: 'link', name: 'Kampüs' })))
    expect(t.description).toContain('bağlantı "Kampüs" (<a>)')
    expect(t.description).toContain('kural-yok-xyz')
    expect(t.fix).toMatch(TURKISH)
    expect(t.fix).toContain('WCAG 4.1.2')
  })

  it('öneri öğeye özeldir: rol, ad ve etiket metne yazılır', () => {
    const t = ruleText('button-name', ctx({ tag: 'button', role: 'button', name: '' }))
    expect(t.fix).toContain('düğme (<button>)')
    expect(elementPhrase({ tag: 'a', role: 'link', name: 'Duyurular' })).toBe('bağlantı "Duyurular" (<a>)')
    expect(elementPhrase({ tag: '', role: null, name: '' })).toBe('ilgili öğe')
  })

  it('kontrast önerisine ölçülen değerler yazılır', () => {
    const t = ruleText(
      'color-contrast',
      ctx({ tag: 'p', name: 'Duyuru', checks: { 'color-contrast': { fgColor: '#aaaaaa', bgColor: '#ffffff', contrastRatio: 2.32, expectedContrastRatio: '4.5:1' } } }),
    )
    expect(t.description).toContain('2.32:1')
    expect(t.fix).toContain('#aaaaaa')
    expect(t.fix).toContain('4.5:1')
  })

  it('dokunma hedefinde ölçülen boyut yazılır', () => {
    const t = ruleText('target-size', ctx({ tag: 'a', role: 'link', name: 'X', checks: { 'target-size': { width: 16, height: 16, minSize: 24 } } }))
    expect(t.description).toContain('16×16 px')
    expect(t.fix).toContain('24×24')
  })

  it('aria-required-children: eksik alt roller ve feed için somut öneri', () => {
    const t = ruleText('aria-required-children', ctx({ tag: 'div', role: 'feed', checks: { 'aria-required-children': { values: ['article'] } } }))
    expect(t.description).toContain('akış (feed) (<div>)')
    expect(t.description).toContain('article')
    expect(t.fix).toContain('<article>')
  })

  it('elle incelenmeli açıklaması Türkçedir', () => {
    expect(manualReviewDescription('color-contrast', 'WCAG 1.4.3')).toContain('elle kontrol edin')
  })
})
