// "En önemli sorunlar" seçimi (saf fonksiyon, birim testli). Yan panelin en üstünde gösterilir.
// Sıralama: şiddet ↓ → aynı kuralı ihlal eden öğe sayısı ↓ → deterministik önce (kesin ölçüm), sonra LLM
// → kural kimliği (eşitlikte kararlı sıra). Aynı kural yalnızca bir kez yer alır.
import { SEVERITIES, type Finding } from './report'

export interface PriorityIssue {
  /** Kuralın temsilci bulgusu (kuraldaki en yüksek şiddetli ilk bulgu). */
  finding: Finding
  /** Aynı kuraldaki tüm bulgular (vurgulamada hepsi gösterilir). */
  findings: Finding[]
  count: number
}

const SEVERITY_RANK = (f: Finding) => SEVERITIES.indexOf(f.severity) // 0 = Kritik

export function topIssues(findings: readonly Finding[], limit = 3): PriorityIssue[] {
  const groups = new Map<string, Finding[]>()
  for (const f of findings) {
    const key = `${f.source}:${f.ruleId}`
    const list = groups.get(key) ?? []
    list.push(f)
    groups.set(key, list)
  }
  const issues: PriorityIssue[] = [...groups.values()].map((list) => {
    const best = list.reduce((a, b) => (SEVERITY_RANK(b) < SEVERITY_RANK(a) ? b : a))
    return { finding: best, findings: list, count: list.length }
  })
  issues.sort(
    (a, b) =>
      SEVERITY_RANK(a.finding) - SEVERITY_RANK(b.finding) ||
      b.count - a.count ||
      (a.finding.source === b.finding.source ? 0 : a.finding.source === 'deterministic' ? -1 : 1) ||
      a.finding.ruleId.localeCompare(b.finding.ruleId),
  )
  return issues.slice(0, limit)
}

/** Öneri metninin ilk cümlesi (en çok 180 karakter); "En önemli sorunlar" kartında tek cümle gösterilir. */
export function firstSentence(text: string, max = 180): string {
  const t = text.replace(/\s+/g, ' ').trim()
  const m = /^(.+?[.!?])(\s|$)/.exec(t)
  const s = m ? m[1] : t
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** Uzun seçiciyi baştan kısaltır (son kısım öğeyi tanımlar). */
export function shortSelector(selector: string, max = 60): string {
  return selector.length > max ? `…${selector.slice(selector.length - (max - 1))}` : selector
}
