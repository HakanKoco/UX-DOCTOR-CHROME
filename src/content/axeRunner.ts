// axe-core'u WCAG 2.2 AA etiketleriyle çalıştırır ve sonuçları rapor bulgularına çevirir.
// axe-core paketten gömülüdür (uzak kod yok).
import axe from 'axe-core'
import {
  AXE_FORCE_ENABLED_RULES,
  AXE_TAGS,
  DETERMINISTIC_CATEGORY_IDS,
  categoryForRule,
  severityFromImpact,
  stripValueAttributes,
  wcagLabelFromTags,
} from '@/shared/axeMapping'
import { manualReviewDescription, ruleText, type RuleContext } from '@/shared/axeTemplates'
import type { DeterministicRaw } from '@/shared/contentApi'
import { maskText } from '@/shared/masking'
import { sanitizeEvidenceHtml } from '@/shared/sanitize'
import type { DeterministicCategoryId, Finding, ManualReviewItem } from '@/shared/report'
import { accessibleName, implicitRole } from './inventory'
import { resolveSelector } from './selector'

let running = false

const NAME_MAX = 60

/** Check kimliği → axe check verisi (şablonlar ölçülen değerleri buradan okur). */
function checkData(node: axe.NodeResult): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of [...node.any, ...node.all, ...node.none]) if (c.data !== undefined && c.data !== null) out[c.id] = c.data
  return out
}

/**
 * Şablon bağlamı: etiket, rol ve maskelenmiş kısa ad. Ad, envanterdeki accessibleName ile alınır
 * (input/textarea/select değeri ve value attribute'u okunmaz).
 */
function ruleContext(node: axe.NodeResult, el: Element | undefined, wcag: string): RuleContext {
  const checks = checkData(node)
  if (!el) return { tag: 'öğe', role: null, name: '', wcag, checks }
  const name = maskText(accessibleName(el).name)
  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role')?.trim().split(/\s+/)[0] || implicitRole(el),
    name: name.length > NAME_MAX ? `${name.slice(0, NAME_MAX)}…` : name,
    wcag,
    checks,
  }
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
        const wcag = wcagLabelFromTags(rule.tags)
        const text = ruleText(rule.id, ruleContext(node, node.element, wcag))
        findings.push({
          id: `D-${rule.id}-${index + 1}`,
          source: 'deterministic',
          selector,
          rule: wcag,
          ruleId: rule.id,
          category,
          severity: severityFromImpact(node.impact ?? rule.impact),
          description: text.description,
          fix: text.fix,
          evidence: { highlightable, html: evidenceHtml(node.html) },
          technicalDetail: {
            help: rule.help,
            helpUrl: rule.helpUrl,
            ...(node.failureSummary ? { summary: maskText(node.failureSummary) } : {}),
          },
        })
      })
    }

    const manualReview: ManualReviewItem[] = results.incomplete.map((rule) => {
      const wcag = wcagLabelFromTags(rule.tags)
      // Kural düzeyinde metin: belirli bir öğeye bağlanmaz (öğeler aşağıda tek tek listelenir).
      return {
        ruleId: rule.id,
        rule: wcag,
        category: categoryForRule(rule.id),
        description: manualReviewDescription(rule.id, wcag),
        fix: ruleText(rule.id, { tag: '', role: null, name: '', wcag, checks: {} }).fix,
        technicalDetail: { help: rule.help, helpUrl: rule.helpUrl },
        nodes: rule.nodes.map((node) => {
          const { selector, highlightable } = resolveSelector(node.target, node.element)
          const reason = [...node.any, ...node.all, ...node.none].find((c) => c.message)?.message
          return { selector, highlightable, html: evidenceHtml(node.html), reason }
        }),
      }
    })

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
