import { useState } from 'react'
import type { SeriesStats } from '@/scoring/stats'
import type { ConsistencyExport } from '@/shared/validationExports'

export const MIN_RUNS = 3
export const MAX_RUNS = 10

interface Props {
  disabledReason: string | null
  busy: boolean
  progress: { done: number; total: number; failed: number } | null
  consistency: ConsistencyExport | null
  canExportHallucination: boolean
  onStartConsistency: (runs: number) => void
  onExportConsistency: () => void
  onExportHallucination: () => void
}

function fmt(v: number | null): string {
  return v === null ? '—' : v.toFixed(1)
}

function StatCells({ s, threshold }: { s: SeriesStats; threshold: number }) {
  const over = s.range !== null && s.range > threshold
  return (
    <>
      <td>{fmt(s.mean)}</td>
      <td>{fmt(s.std)}</td>
      <td className={over ? 'status error' : undefined}>
        {s.min === null ? '—' : `${fmt(s.min)}–${fmt(s.max)}`}
        {over && ' (>10)'}
      </td>
    </>
  )
}

/** Ödev Bölüm 4 araçları: tutarlılık testi ve halüsinasyon elle doğrulama dışa aktarımı. */
export default function ValidationTools(props: Props) {
  const [runs, setRuns] = useState(MIN_RUNS)
  const c = props.consistency
  return (
    <section aria-labelledby="validation-title">
      <h2 id="validation-title">Doğrulama araçları</h2>

      <div className="card">
        <h3>Tutarlılık testi</h3>
        <p className="muted">
          Envanter bir kez çıkarılır ve aynı istek gövdesi N kez gönderilir; böylece sapma yalnızca LLM'den gelir. Her
          çalıştırmanın ham yanıtı, prompt sürümü, model ve zaman damgası kaydedilir.
        </p>
        <div className="row">
          <label htmlFor="runs">Çalıştırma sayısı (N ≥ {MIN_RUNS})</label>
          <input
            id="runs"
            type="number"
            min={MIN_RUNS}
            max={MAX_RUNS}
            value={runs}
            onChange={(e) => setRuns(Math.min(MAX_RUNS, Math.max(MIN_RUNS, Number(e.target.value) || MIN_RUNS)))}
            style={{ width: '5em' }}
          />
          <button
            type="button"
            disabled={props.busy || props.disabledReason !== null}
            onClick={() => props.onStartConsistency(runs)}
          >
            Aynı sayfayı {runs} kez analiz et
          </button>
        </div>
        {props.disabledReason && <p className="muted">{props.disabledReason}</p>}
        {props.progress && (
          <p role="status">
            İlerleme: {props.progress.done}/{props.progress.total} tamamlandı
            {props.progress.failed > 0 && `, ${props.progress.failed} başarısız`}
          </p>
        )}

        {c && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="score-table">
                <caption className="muted" style={{ textAlign: 'left' }}>
                  {c.completedRuns}/{c.requestedRuns} çalıştırma · {c.provider} / {c.requestedModel} · {c.promptVersion}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">İlke</th>
                    {c.runs.map((r) => (
                      <th scope="col" key={r.runId}>
                        #{r.runIndex}
                      </th>
                    ))}
                    <th scope="col">Ort.</th>
                    <th scope="col">Std</th>
                    <th scope="col">Min–max</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(c.stats.principles).map(([id, s]) => (
                    <tr key={id}>
                      <th scope="row">{s.label}</th>
                      {c.runs.map((r) => (
                        <td key={r.runId}>{fmt(r.principleScores[id as keyof typeof r.principleScores])}</td>
                      ))}
                      <StatCells s={s} threshold={c.stats.threshold} />
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">LLM toplam</th>
                    {c.runs.map((r) => (
                      <td key={r.runId}>{fmt(r.llmScore)}</td>
                    ))}
                    <StatCells s={c.stats.llmTotal} threshold={c.stats.threshold} />
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              En büyük aralık: <strong>{fmt(c.stats.maxRange)}</strong> puan.{' '}
              {c.stats.exceedsThreshold
                ? '10 puanı aşıyor: README doğrulama bölümünde nedenini ve çözümünüzü açıklayın (soru uyumu tablosu dışa aktarımda).'
                : '10 puan eşiğinin altında.'}
            </p>
            {c.failures.length > 0 && (
              <p className="status error">Başarısız çalıştırmalar: {c.failures.map((f) => `#${f.runIndex} (${f.error})`).join('; ')}</p>
            )}
            <button type="button" onClick={props.onExportConsistency}>
              Tutarlılık sonuçlarını JSON olarak indir
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h3>Halüsinasyon kontrolü</h3>
        <p className="muted">
          Otomatik kontrol her LLM analizinde yapılır (kimlik envanterde mi, seçici sayfada mı). Elle doğrulama için her
          LLM bulgusunu "gerçek mi?" alanı boş olarak dışa aktarın, sayfada tek tek kontrol edip doldurun.
        </p>
        <button type="button" disabled={!props.canExportHallucination} onClick={props.onExportHallucination}>
          Elle doğrulama listesini JSON olarak indir
        </button>
        {!props.canExportHallucination && <p className="muted">Önce bir LLM analizi yapın.</p>}
      </div>
    </section>
  )
}
