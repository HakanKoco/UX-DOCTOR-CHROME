import { attemptedRuns, isComplete, type ConsistencyProgress } from '@/shared/consistencyProgress'

interface Props {
  record: ConsistencyProgress
  busy: boolean
  onResume: () => void
  onExport: () => void
  onDiscard: () => void
}

/**
 * chrome.storage.local'deki tutarlılık testi kaydı: panel kapansa ya da 503 yüzünden test dursa bile biten
 * çalıştırmalar kaybolmaz. Yarım testi kaldığı yerden sürdürmek yine onay ekranından geçer.
 */
export default function ConsistencyResumeCard({ record, busy, onResume, onExport, onDiscard }: Props) {
  const done = attemptedRuns(record)
  const complete = isComplete(record)
  return (
    <section className="card" aria-labelledby="resume-title">
      <h2 id="resume-title">{complete ? 'Kayıtlı tutarlılık testi' : 'Yarım kalan tutarlılık testi'}</h2>
      <p>
        <code>{record.page.url}</code> · {record.request.provider} / <code>{record.request.model}</code> ·{' '}
        {done}/{record.requestedRuns} çalıştırma bitti ({record.results.length} başarılı, {record.failures.length}{' '}
        başarısız) · başlangıç {new Date(record.startedAt).toLocaleString('tr-TR')}
      </p>
      {record.pausedReason && <p className="muted">Durma nedeni: {record.pausedReason}</p>}
      <div className="row">
        {!complete && (
          <button type="button" onClick={onResume} disabled={busy}>
            Kaldığı yerden devam et
          </button>
        )}
        <button type="button" className={complete ? undefined : 'secondary'} onClick={onExport} disabled={busy}>
          {complete ? 'Tutarlılık sonuçlarını JSON olarak indir' : 'Şu ana kadarki sonuçları JSON olarak indir'}
        </button>
        <button type="button" className="secondary" onClick={onDiscard} disabled={busy}>
          Kaydı sil
        </button>
      </div>
    </section>
  )
}
