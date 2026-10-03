import { firstSentence, shortSelector, topIssues } from '@/shared/prioritize'
import type { Finding } from '@/shared/report'
import { SeverityBadge } from './FindingList'

interface Props {
  findings: Finding[]
  onHighlight: (findings: Finding[], scroll: boolean) => void
}

/** En önemli 3 sorun: şiddet sırasına göre, her kural bir kez (src/shared/prioritize.ts). */
export default function TopIssues({ findings, onHighlight }: Props) {
  const issues = topIssues(findings, 3)
  return (
    <section aria-labelledby="top-title" className="card">
      <h2 id="top-title">En önemli 3 sorun</h2>
      {issues.length === 0 ? (
        <p className="muted">Kanıtlı bir sorun bulunmadı.</p>
      ) : (
        <ol className="top-issues">
          {issues.map(({ finding, findings: all, count }) => {
            const highlightable = all.filter((f) => f.evidence.highlightable)
            return (
              <li key={`${finding.source}:${finding.ruleId}`} className="finding">
                <div className="row finding-head">
                  <SeverityBadge severity={finding.severity} />
                  <strong>{finding.rule}</strong>
                  <code>{finding.ruleId}</code>
                  {count > 1 && <span className="count-badge">{count} öğe</span>}
                  <span className="muted">{finding.source === 'llm' ? 'LLM' : 'deterministik'}</span>
                </div>
                <p className="finding-fix">{firstSentence(finding.fix)}</p>
                <p className="selector">
                  <code title={finding.selector}>{shortSelector(finding.selector)}</code>
                </p>
                <button
                  type="button"
                  className="secondary"
                  disabled={highlightable.length === 0}
                  onClick={() => onHighlight(highlightable, true)}
                >
                  Sayfada göster{count > 1 ? ` (${highlightable.length})` : ''}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
