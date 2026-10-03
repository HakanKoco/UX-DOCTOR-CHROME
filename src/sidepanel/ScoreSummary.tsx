import type { LayerScore, ReportScores } from '@/shared/report'

function fmt(score: number | null): string {
  return score === null ? '—' : score.toFixed(1)
}

function LayerTable({ title, layer, detailLabel }: { title: string; layer: LayerScore; detailLabel: (d: Record<string, number>) => string }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="score-table">
        <caption className="muted" style={{ textAlign: 'left' }}>
          {title}
        </caption>
        <thead>
          <tr>
            <th scope="col">Alt skor</th>
            <th scope="col">Skor</th>
            <th scope="col">Ağırlık</th>
            <th scope="col">Hesap</th>
          </tr>
        </thead>
        <tbody>
          {layer.categories.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.label}</th>
              <td>{c.score === null ? 'uygulanamaz' : fmt(c.score)}</td>
              <td>{(c.weight * 100).toFixed(1)}%</td>
              <td className="muted">{detailLabel(c.detail)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Deterministik ve LLM skorları ayrı gösterilir; toplam, formül ağırlıklarıyla birlikte yazılır. */
export default function ScoreSummary({ scores }: { scores: ReportScores }) {
  return (
    <section aria-labelledby="score-title" className="card">
      <h2 id="score-title">Skorlar (0-100)</h2>
      <div className="score-grid">
        <div className="score-tile">
          <div className="muted">Toplam</div>
          <div className="value">{fmt(scores.overall)}</div>
          <div className="muted">
            {scores.llmIncluded
              ? `%${scores.layerWeights.deterministic * 100} deterministik + %${scores.layerWeights.llm * 100} LLM`
              : 'Yalnızca deterministik (LLM analizi yok)'}
          </div>
        </div>
        <div className="score-tile">
          <div className="muted">Deterministik (axe-core)</div>
          <div className="value">{fmt(scores.deterministic.score)}</div>
        </div>
        <div className="score-tile">
          <div className="muted">LLM (Norman)</div>
          <div className="value">{fmt(scores.llm?.score ?? null)}</div>
        </div>
      </div>
      <details>
        <summary>Alt skorlar ve hesap ayrıntısı</summary>
        <LayerTable
          title="Deterministik: S = 100 × geçen / (geçen + Σ şiddet ağırlığı)"
          layer={scores.deterministic}
          detailLabel={(d) => `${d.passedNodes} geçen, ${d.violationNodes} ihlal (ağırlıklı ${d.weightedViolations})`}
        />
        {scores.llm && (
          <LayerTable
            title="LLM: S = 100 × Σw(evet) / (Σw(evet) + Σw(hayır)); belirsiz hariç"
            layer={scores.llm}
            detailLabel={(d) => `${d.yes} evet, ${d.no} hayır, ${d.uncertain} belirsiz`}
          />
        )}
        <p className="muted">Formül sürümü: {scores.formulaVersion}</p>
      </details>
    </section>
  )
}
