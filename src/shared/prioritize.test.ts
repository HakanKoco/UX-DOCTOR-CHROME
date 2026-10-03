import { describe, expect, it } from 'vitest'
import type { Finding, Severity } from './report'
import { firstSentence, shortSelector, topIssues } from './prioritize'

let seq = 0
function f(ruleId: string, severity: Severity, source: Finding['source'] = 'deterministic'): Finding {
  seq++
  return {
    id: `F${seq}`,
    source,
    selector: `#e${seq}`,
    rule: source === 'llm' ? 'Norman: Görünürlük' : 'WCAG 1.1.1',
    ruleId,
    category: source === 'llm' ? 'visibility' : 'other-wcag',
    severity,
    description: 'açıklama',
    fix: 'Birinci cümle. İkinci cümle.',
    evidence: { highlightable: true },
  }
}

describe('topIssues', () => {
  it('şiddete göre sıralar ve ilk 3 kuralı seçer', () => {
    const r = topIssues([f('a', 'Düşük'), f('b', 'Kritik'), f('c', 'Orta'), f('d', 'Yüksek')])
    expect(r.map((i) => i.finding.ruleId)).toEqual(['b', 'd', 'c'])
  })

  it('aynı kural yalnızca bir kez yer alır; öğe sayısı ve tüm bulgular taşınır', () => {
    const r = topIssues([...Array.from({ length: 5 }, () => f('target-size', 'Yüksek')), f('x', 'Orta'), f('y', 'Düşük')])
    expect(r.map((i) => i.finding.ruleId)).toEqual(['target-size', 'x', 'y'])
    expect(r[0].count).toBe(5)
    expect(r[0].findings).toHaveLength(5)
  })

  it('eşit şiddette çok öğeli kural önce, sonra deterministik, sonra LLM', () => {
    const r = topIssues([f('llm1', 'Yüksek', 'llm'), f('det1', 'Yüksek'), f('det2', 'Yüksek'), f('det2', 'Yüksek')])
    expect(r.map((i) => i.finding.ruleId)).toEqual(['det2', 'det1', 'llm1'])
  })

  it('temsilci bulgu kuraldaki en yüksek şiddetli bulgudur', () => {
    const r = topIssues([f('k', 'Orta'), f('k', 'Kritik'), f('k', 'Orta')])
    expect(r[0].finding.severity).toBe('Kritik')
  })

  it('3ten az bulgu ya da hiç bulgu', () => {
    expect(topIssues([f('a', 'Orta')])).toHaveLength(1)
    expect(topIssues([])).toEqual([])
  })

  it('aynı girdi her seferinde aynı sırayı verir', () => {
    const input = [f('c', 'Orta'), f('a', 'Orta'), f('b', 'Orta')]
    expect(topIssues(input).map((i) => i.finding.ruleId)).toEqual(['a', 'b', 'c'])
  })
})

describe('firstSentence / shortSelector', () => {
  it('ilk cümleyi alır', () => {
    expect(firstSentence('Birinci cümle. İkinci cümle.')).toBe('Birinci cümle.')
    expect(firstSentence('Noktasız tek cümle')).toBe('Noktasız tek cümle')
    expect(firstSentence('x'.repeat(300)).length).toBe(180)
  })
  it('uzun seçiciyi baştan kısaltır', () => {
    expect(shortSelector('#kisa')).toBe('#kisa')
    const s = shortSelector(`html > body > ${'div > '.repeat(20)}a`)
    expect(s.startsWith('…')).toBe(true)
    expect(s.endsWith('div > a')).toBe(true)
    expect(s.length).toBe(60)
  })
})
