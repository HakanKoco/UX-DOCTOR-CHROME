// axe-core'u WCAG 2.2 AA etiketleriyle çalıştırır ve sonuçları rapor bulgularına çevirir.
// axe-core paketten gömülüdür (uzak kod yok).
import axe from 'axe-core'
import {
  AXE_FORCE_ENABLED_RULES,
  AXE_TAGS,
  DETERMINISTIC_CATEGORY_IDS,
  categoryForRule,
  describeRule,
  fixForRule,
  severityFromImpact,
  stripValueAttributes,
  wcagLabelFromTags,
} from '@/shared/axeMapping'
import type { DeterministicRaw } from '@/shared/contentApi'
import { sanitizeEvidenceHtml } from '@/shared/sanitize'
import type { DeterministicCategoryId, Finding, ManualReviewItem } from '@/shared/report'
import { resolveSelector } from './selector'

let running = false

function firstCheckData(node: axe.NodeResult): unknown {
  return [...node.any, ...node.all, ...node.none].find((c) => c.data !== undefined && c.data !== null)?.data
}

function evidenceHtml(html: string): string {
  return sanitizeEvidenceHtml(stripValueAttributes(html))
}

export async function runDeterministic(): Promise<DeterministicRaw> {
  if (running) throw new Error('Analiz zaten çalışıyor.')
  running = true
  try {
    const rules: axe.RuleObject = {}
    for (const id of AXE_FORCE_ENABLED_RULES) rules[id] = { enabled: true }
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: [...AXE_TAGS] },
      rules,
      elementRef: true,
      iframes: false,
      selectors: true,
      ancestry: false,
      xpath: false,
      absolutePaths: false,
    })

    const findings: Finding[] = []
    for (const rule of results.violations) {
      const category = categoryForRule(rule.id)
      rule.nodes.forEach((node, index) => {
        const { selector, highlightable } = resolveSelector(node.target, node.element)
        findings.push({
          id: `D-${rule.id}-${index + 1}`,
          source: 'deterministic',
          selector,
          rule: wcagLabelFromTags(rule.tags),
          ruleId: rule.id,
          category,
          severity: severityFromImpact(node.impact ?? rule.impact),
          description: describeRule(rule.id, rule.help),
          fix: fixForRule(rule.id, rule.help, rule.helpUrl, firstCheckData(node)),
          evidence: { highlightable, html: evidenceHtml(node.html) },
        })
      })
    }

    const manualReview: ManualReviewItem[] = results.incomplete.map((rule) => ({
      ruleId: rule.id,
      rule: wcagLabelFromTags(rule.tags),
      category: categoryForRule(rule.id),
      description: describeRule(rule.id, rule.help),
      nodes: rule.nodes.map((node) => {
        const { selector, highlightable } = resolveSelector(node.target, node.element)
        const reason = [...node.any, ...node.all, ...node.none].find((c) => c.message)?.message
        return { selector, highlightable, html: evidenceHtml(node.html), reason }
      }),
    }))

    const passesByCategory = Object.fromEntries(DETERMINISTIC_CATEGORY_IDS.map((id) => [id, 0])) as Record<
      DeterministicCategoryId,
      number
    >
    for (const rule of results.passes) passesByCategory[categoryForRule(rule.id)] += rule.nodes.length

    return {
      engineVersion: axe.version,
      tags: [...AXE_TAGS],
      ranAt: new Date().toISOString(),
      findings,
      manualReview,
      passesByCategory,
    }
  } finally {
    running = false
  }
}
