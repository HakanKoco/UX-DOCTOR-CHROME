import { useEffect, useRef } from 'react'

interface Props {
  /** Claude API'ye gönderilecek istek gövdesi (API anahtarı içermez; anahtar başlıkta, service worker ekler). */
  requestBody: unknown
  model: string
  runs: number
  onSend: () => void
  onCancel: () => void
}

/**
 * Her LLM gönderiminden önce açılan onay ekranı. Gönderilecek JSON'un tamamı gösterilir;
 * kullanıcı "Gönder" demeden istek atılmaz.
 */
export default function ConfirmSendDialog({ requestBody, model, runs, onSend, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const json = JSON.stringify(requestBody, null, 2)
  const kb = (new TextEncoder().encode(json).length / 1024).toFixed(1)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h2 id="confirm-title">Claude API'ye gönderim onayı</h2>
        <div id="confirm-desc">
          <p>
            Aşağıdaki JSON, <code>{model}</code> modeline{' '}
            {runs > 1 ? (
              <strong>aynı içerikle {runs} kez (tutarlılık testi)</strong>
            ) : (
              <strong>bir kez</strong>
            )}{' '}
            gönderilecek ({kb} KB). Ekran görüntüsü, form değerleri ve sayfanın tam HTML'i gönderilmez; metinler
            maskelenmiştir.
          </p>
          <p className="muted">API anahtarı bu gövdede yoktur; istek başlığına service worker tarafından eklenir.</p>
        </div>
        <pre className="preview" tabIndex={0} aria-label="Gönderilecek JSON">
          {json}
        </pre>
        <div className="row">
          <button type="button" onClick={onSend}>
            Gönder
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            İptal
          </button>
        </div>
      </div>
    </div>
  )
}
