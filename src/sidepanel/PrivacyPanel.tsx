import type { PrivacyRecord } from '@/shared/report'

interface Props {
  privacy: PrivacyRecord
  onConsentChange: (consent: boolean) => void
}

/**
 * Hassas sayfa tespiti sonucu. Hassas sayfada LLM gönderimi kilitlidir; kullanıcı aşağıdaki kutuyu
 * işaretlerse açılır ve bu onay (zaman damgasıyla) rapora yazılır.
 */
export default function PrivacyPanel({ privacy, onConsentChange }: Props) {
  if (!privacy.sensitive) {
    return (
      <p className="muted" role="status">
        Gizlilik: hassas sayfa işareti bulunmadı (şifre/kart alanı, oturum metni ya da hesap URL'si yok).
      </p>
    )
  }
  return (
    <div className="warning" role="alert">
      <p>
        <strong>Bu sayfa hassas olabilir. LLM gönderimi kilitlendi.</strong>
      </p>
      <ul>
        {privacy.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p>
        Giriş yapılmış, kişisel ya da sağlık verisi içeren sayfaları analiz etmeyin. Yine de devam ederseniz LLM'e
        yalnızca maskelenmiş öğe envanteri gider ve onayınız rapora kaydedilir.
      </p>
      <label className="row">
        <input type="checkbox" checked={privacy.consentGiven} onChange={(e) => onConsentChange(e.target.checked)} />
        <span>Sayfanın hassas olabileceğini anlıyorum; maskelenmiş özetin gönderilmesine açıkça onay veriyorum.</span>
      </label>
      {privacy.consentGiven && privacy.consentAt && <p className="muted">Onay zamanı: {privacy.consentAt}</p>}
    </div>
  )
}
