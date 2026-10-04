import { useEffect, useRef } from 'react'
import { PROVIDER_API_NAMES } from '@/shared/llmRequest'
import type { Provider } from '@/shared/models'

interface Props {
  provider: Provider
  /** LLM API'ye gönderilecek istek gövdesi (API anahtarı içermez; anahtar başlıkta, service worker ekler). */
  requestBody: unknown
  model: string
  runs: number
  /** İstek adresi, anahtarın konduğu başlığın adı ve gövde dışında gönderilen diğer başlıklar (anahtar hariç). */
  transport: { url: string; keyHeader: string; headers: Record<string, string> }
  /** Tutarlılık testinde çalıştırmalar arası bekleme (ms). */
  runIntervalMs: number
  /** 429/503'te en çok kaç kez yeniden denenir. */
  maxRetries: number
  /** Kullanıcı mesajının okunur hali (gövdedeki JSON metninin ayrıştırılmış görünümü). */
  readableUserPayload: unknown
  /** Bu gönderime özgü açıklama (yarım testin devamı, elle onaylı yedek model…). */
  note?: string
  onSend: () => void
  onCancel: () => void
}

/**
 * Her LLM gönderiminden önce açılan onay ekranı. Gönderilecek JSON'un tamamı gösterilir;
 * kullanıcı "Gönder" demeden istek atılmaz.
 */
export default function ConfirmSendDialog({
  provider,
  requestBody,
  model,
  runs,
  transport,
  runIntervalMs,
  maxRetries,
  readableUserPayload,
  note,
  onSend,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const json = JSON.stringify(requestBody, null, 2)
  const kb = (new TextEncoder().encode(json).length / 1024).toFixed(1)
  const apiName = PROVIDER_API_NAMES[provider]

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
        <h2 id="confirm-title">{apiName}'ye gönderim onayı</h2>
        <div id="confirm-desc">
          {provider === 'gemini' && (
            <div className="warning" role="note">
              <p>
                <strong>Gemini ücretsiz katman uyarısı:</strong> Google, ücretsiz katmanda gönderilen içeriği ve yanıtları
                ürünlerini ve makine öğrenmesi teknolojilerini (model eğitimi dahil) geliştirmek için kullanabilir; insan incelemeciler girdi ve çıktıları
                okuyabilir. Gönderilen veri maskelenmiş öğe envanteridir, ama hassas bir sayfadaysanız göndermeyin.
              </p>
            </div>
          )}
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
          {note && (
            <p>
              <strong>{note}</strong>
            </p>
          )}
          <p className="muted">
            {runs > 1 && runIntervalMs > 0 && <>Çalıştırmalar arasında {runIntervalMs / 1000} sn beklenir. </>}
            İstek sınırı (429) ya da geçici kullanılamama (503) hatasında aynı istek, panelde geri sayımla ve üstel
            beklemeyle en çok {maxRetries} kez yeniden gönderilir; "Durdur" ile istediğiniz an kesebilirsiniz.
          </p>
          <p className="muted">
            Adres: <code>{transport.url}</code>. API anahtarı bu gövdede ve adreste yoktur; <code>{transport.keyHeader}</code>{' '}
            başlığına service worker tarafından eklenir. Diğer başlıklar:{' '}
            {Object.entries(transport.headers).map(([k, v], i) => (
              <span key={k}>
                {i > 0 && ', '}
                <code>{`${k}: ${v}`}</code>
              </span>
            ))}
            .
          </p>
        </div>
        <h3>İstek gövdesi (gönderilecek JSON'un tamamı)</h3>
        <pre className="preview" tabIndex={0} aria-label="Gönderilecek JSON">
          {json}
        </pre>
        <details>
          <summary>Kullanıcı mesajının okunur görünümü (yukarıdaki kullanıcı metninin aynısı)</summary>
          <pre className="preview" tabIndex={0} aria-label="Kullanıcı mesajı, okunur görünüm">
            {JSON.stringify(readableUserPayload, null, 2)}
          </pre>
        </details>
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
