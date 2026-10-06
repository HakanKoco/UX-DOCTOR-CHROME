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
              <td>{c.score === null ? (c.detail.insufficientCoverage ? 'yetersiz kapsam' : 'uygulanamaz') : fmt(c.score)}</td>
              <td>{(c.weight * 100).toFixed(1)}%</td>
              <td className="muted">{detailLabel(c.detail)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function deterministicTitle(layer: LayerScore): string {
  const c = layer.components
  const parts = c
    ? ` Kategori yarısı ${fmt(c.categoryScore)}, kural yarısı ${fmt(c.ruleScore)} (${c.violatedRules} benzersiz kural, R = ${c.ruleWeightSum}).`
    : ''
  return `Deterministik: alt skor S_c = 100·e^(−D_c/25), D_c = Σ w·(1+log₂ n). Skor = ½ · alt skorların ağırlıklı geometrik ortalaması + ½ · 100·e^(−R/20), R = benzersiz kuralların şiddet ağırlıkları toplamı.${parts}`
}

function llmTitle(layer: LayerScore): string {
  const cov = layer.coverage
  const coverage = cov
    ? ` Kapsam: ${cov.answered}/${cov.questions} soru evet/hayır ile yanıtlandı; ${cov.minAnsweredPerPrinciple} sorudan azı yanıtlanan ilke "yetersiz kapsam" olur ve ortalamaya girmez.`
    : ''
  return `LLM: S = 100 × Σw(evet) / (Σw(evet) + Σw(hayır)); belirsiz hariç.${coverage}`
}

function llmDetail(d: Record<string, number>): string {
  const base = `${d.yes} evet, ${d.no} hayır, ${d.uncertain} belirsiz`
  const answered = d.questions ? ` (${d.answered}/${d.questions} yanıtlı)` : ''
  const dropped = (d.evidencelessNo ?? 0) + (d.hallucinatedNo ?? 0)
  const droppedText = dropped
    ? `; belirsize düşen hayır: ${d.evidencelessNo ?? 0} kanıtsız, ${d.hallucinatedNo ?? 0} halüsinasyonlu`
    : ''
  return base + answered + droppedText
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
          <div className="muted">
            {scores.llm
              ? scores.llm.coverage
                ? `kapsam ${scores.llm.coverage.answered}/${scores.llm.coverage.questions} soru`
                : 'yorumsal'
              : 'henüz çalıştırılmadı'}
          </div>
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
          title={deterministicTitle(scores.deterministic)}
          layer={scores.deterministic}
          detailLabel={(d) => `${d.violatedRules} kural / ${d.violationNodes} öğe ihlal, ceza D_c = ${d.penalty} (${d.passedNodes} geçen öğe skora girmez)`}
        />
        {scores.llm && (
          <LayerTable
            title={llmTitle(scores.llm)}
            layer={scores.llm}
            detailLabel={llmDetail}
          />
        )}
        {scores.llm && scores.llm.strictScore !== undefined && (
          <p className="muted">
            Bilgi amaçlı katı skor: <strong>{fmt(scores.llm.strictScore)}</strong>. Kanıtsız ya da envanterde olmayan
            öğeye dayanan &quot;hayır&quot;lar &quot;hayır&quot; sayılsaydı LLM skoru bu olurdu. Resmi skor ve toplam bunu
            kullanmaz.
          </p>
        )}
        <p className="muted">Formül sürümü: {scores.formulaVersion}</p>
      </details>
    </section>
  )
}
