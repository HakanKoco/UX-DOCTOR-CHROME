import type { ManualReviewItem } from '@/shared/report'
import { TechnicalDetailBlock, ThirdPartyBadge } from './FindingList'

interface Props {
  items: ManualReviewItem[]
  onHighlight: (selector: string) => void
}

/** axe'in "incomplete" sonuçları: ihlal sayılmaz, skora girmez; bir insanın bakması gerekir. */
export default function ManualReviewList({ items, onHighlight }: Props) {
  const nodeCount = items.reduce((n, i) => n + i.nodes.length, 0)
  return (
    <details className="group">
      <summary>
        Elle incelenmeli — <strong>{nodeCount}</strong> öğe, {items.length} kural
      </summary>
      <p className="muted">
        axe bu öğeler için kesin karar veremedi (ör. arka planı görsel olan metinde kontrast). Bunlar ihlal sayılmaz ve
        skora girmez.
      </p>
      <ul className="findings">
        {items.map((item) => (
          <li key={item.ruleId} className="finding">
            <div className="row finding-head">
              <strong>{item.rule}</strong> <code>{item.ruleId}</code>
            </div>
            <p className="finding-desc">{item.description}</p>
            {item.fix && (
              <p className="finding-fix">
                <span className="label">Öneri:</span> {item.fix}
              </p>
            )}
            {item.technicalDetail && <TechnicalDetailBlock detail={item.technicalDetail} />}
            <ul className="nodes">
              {item.nodes.slice(0, 20).map((node, i) => (
                <li key={`${node.selector}-${i}`}>
                  <code>{node.selector}</code>
                  {node.reason && <span className="muted" lang="en"> — {node.reason}</span>}{' '}
                  {node.thirdParty && <ThirdPartyBadge tag={node.thirdParty} />}{' '}
                  <button
                    type="button"
                    className="secondary small"
                    disabled={!node.highlightable}
                    onClick={() => onHighlight(node.selector)}
                  >
                    Göster
                  </button>
                </li>
              ))}
              {item.nodes.length > 20 && <li className="muted">… ve {item.nodes.length - 20} öğe daha</li>}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  )
}
