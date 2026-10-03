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
      <div className="score-grid two">
        <div className="score-tile">
          <div className="muted">Deterministik (axe-core, WCAG 2.2 AA)</div>
          <div className="value">{fmt(scores.deterministic.score)}</div>
          <div className="muted">kesin ölçüm</div>
        </div>
        <div className="score-tile">
          <div className="muted">LLM (Norman ilkeleri)</div>
          <div className="value">{fmt(scores.llm?.score ?? null)}</div>
          <div className="muted">{scores.llm ? 'yorumsal' : 'henüz çalıştırılmadı'}</div>
        </div>
      </div>
      <p className="muted">
        Ağırlıklı toplam: <strong>{fmt(scores.overall)}</strong>{' '}
        {scores.llmIncluded
          ? `(%${scores.layerWeights.deterministic * 100} deterministik + %${scores.layerWeights.llm * 100} LLM)`
          : '(yalnızca deterministik; LLM analizi yok)'}
      </p>
      <details>
        <summary>Alt skorlar ve hesap ayrıntısı</summary>
        <LayerTable
          title={`Deterministik: kural cezası w·(1+log₂ n); alt skor 100·e^(−D_c/25); toplam 100·e^(−Σ α_c·D_c/25), α_c = 6 × ağırlık. Toplam ceza D = ${scores.deterministic.penalty ?? '—'}`}
          layer={scores.deterministic}
          detailLabel={(d) => `${d.violatedRules} kural / ${d.violationNodes} öğe ihlal, ceza ${d.penalty} × ${d.multiplier} (${d.passedNodes} geçen öğe skora girmez)`}
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
