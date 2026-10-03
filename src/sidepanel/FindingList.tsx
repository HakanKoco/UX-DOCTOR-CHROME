import { useState } from 'react'
import type { Finding, Severity, TechnicalDetail } from '@/shared/report'
import { SEVERITIES } from '@/shared/report'

const PAGE_SIZE = 15

export interface FindingGroup {
  id: string
  label: string
  findings: Finding[]
}

interface Props {
  groups: FindingGroup[]
  onHighlight: (findings: Finding[], scroll: boolean) => void
  onScreenshot?: (finding: Finding) => void
  emptyText: string
}

/** axe'in özgün (İngilizce) metni yalnızca burada, kapalı bir bölümde gösterilir. */
export function TechnicalDetailBlock({ detail }: { detail: TechnicalDetail }) {
  return (
    <details>
      <summary>Teknik ayrıntı (axe, İngilizce)</summary>
      <p className="muted">{detail.help}</p>
      {detail.summary && <pre className="snippet">{detail.summary}</pre>}
      <p className="muted">
        Kaynak:{' '}
        <a href={detail.helpUrl} target="_blank" rel="noreferrer">
          {detail.helpUrl}
        </a>
      </p>
    </details>
  )
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge sev-${SEVERITIES.indexOf(severity)}`}>{severity}</span>
}

function severityCounts(findings: Finding[]): string {
  return SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(', ')
}

function FindingItem({ finding, onHighlight, onScreenshot }: { finding: Finding } & Pick<Props, 'onHighlight' | 'onScreenshot'>) {
  return (
    <li className="finding">
      <div className="row finding-head">
        <SeverityBadge severity={finding.severity} />
        <strong>{finding.rule}</strong>
        {finding.elementId && <code>{finding.elementId}</code>}
      </div>
      <p className="finding-desc">{finding.description}</p>
      <p className="finding-fix">
        <span className="label">Öneri:</span> {finding.fix}
      </p>
      <p className="selector">
        <span className="label">Seçici:</span> <code>{finding.selector}</code>
      </p>
      {finding.evidence.relatedElements && finding.evidence.relatedElements.length > 0 && (
        <p className="selector">
          <span className="label">Diğer kanıt öğeleri:</span>{' '}
          {finding.evidence.relatedElements.map((r) => r.elementId).join(', ')}
        </p>
      )}
      {finding.evidence.html && (
        <details>
          <summary>HTML parçası</summary>
          <pre className="snippet">{finding.evidence.html}</pre>
        </details>
      )}
      {finding.technicalDetail && <TechnicalDetailBlock detail={finding.technicalDetail} />}
      {finding.evidence.screenshot && (
        <img className="evidence-shot" src={finding.evidence.screenshot} alt={`Kanıt görüntüsü: ${finding.selector}`} />
      )}
      <div className="row">
        <button
          type="button"
          className="secondary"
          disabled={!finding.evidence.highlightable}
          title={finding.evidence.highlightable ? undefined : 'Öğe shadow DOM ya da iframe içinde; vurgulanamaz.'}
          onClick={() => onHighlight([finding], true)}
        >
          Sayfada göster
        </button>
        {onScreenshot && (
          <button
            type="button"
            className="secondary"
            disabled={!finding.evidence.highlightable}
            onClick={() => onScreenshot(finding)}
          >
            Kanıt görüntüsü al
          </button>
        )}
      </div>
    </li>
  )
}

function Group({ group, ...rest }: { group: FindingGroup } & Omit<Props, 'groups' | 'emptyText'>) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const highlightable = group.findings.filter((f) => f.evidence.highlightable)
  return (
    <details className="group" open={group.findings.length > 0 && group.findings.length <= 5}>
      <summary>
        {group.label} — <strong>{group.findings.length}</strong> bulgu
        {group.findings.length > 0 && <span className="muted"> ({severityCounts(group.findings)})</span>}
      </summary>
      {group.findings.length > 0 && (
        <>
          <div className="row">
            <button
              type="button"
              className="secondary"
              disabled={highlightable.length === 0}
              onClick={() => rest.onHighlight(highlightable, false)}
            >
              Bu gruptakilerin tümünü vurgula
            </button>
          </div>
          <ul className="findings">
            {group.findings.slice(0, visible).map((f) => (
              <FindingItem key={f.id} finding={f} onHighlight={rest.onHighlight} onScreenshot={rest.onScreenshot} />
            ))}
          </ul>
          {visible < group.findings.length && (
            <button type="button" className="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Daha fazla göster ({group.findings.length - visible} kaldı)
            </button>
          )}
        </>
      )}
    </details>
  )
}

export default function FindingList({ groups, emptyText, ...rest }: Props) {
  const total = groups.reduce((n, g) => n + g.findings.length, 0)
  return (
    <>
      {total === 0 && <p className="muted">{emptyText}</p>}
      {groups.map((g) => (
        <Group key={g.id} group={g} {...rest} />
      ))}
    </>
  )
}
