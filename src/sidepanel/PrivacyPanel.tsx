import type { PrivacyRecord } from '@/shared/report'

interface Props {
  privacy: PrivacyRecord
  onConsentChange: (consent: boolean) => void
}

function ReasonList({ title, reasons }: { title: string; reasons: string[] }) {
  if (reasons.length === 0) return null
  return (
    <>
      <p>{title}</p>
      <ul>
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </>
  )
}

/**
 * Hassas sayfa tespiti sonucu (üç durum). "Hassas" ve "belirsiz" sayfada LLM gönderimi kilitlidir; kullanıcı aşağıdaki
 * kutuyu işaretlerse açılır ve bu onay (zaman damgasıyla) rapora yazılır. Şüphede gönderilmez.
 */
export default function PrivacyPanel({ privacy, onConsentChange }: Props) {
  if (privacy.level === 'safe') {
    return (
      <p className="muted" role="status">
        Gizlilik: hassas değil. Şifre/kart alanı, oturum metni, hesap/uygulama URL'si ya da uygulama kabuğu işareti
        bulunmadı.
      </p>
    )
  }
  const uncertain = privacy.level === 'uncertain'
  return (
    <div className="warning" role="alert">
      <p>
        <strong>
          {uncertain
            ? 'Gizlilik: belirsiz. Bu sayfa kişisel ya da oturum açılmış bir sayfa olabilir. LLM gönderimi kilitlendi.'
            : 'Gizlilik: hassas. Bu sayfa giriş yapılmış, kişisel ya da özel bir uygulama sayfası görünüyor. LLM gönderimi kilitlendi.'}
        </strong>
      </p>
      <ReasonList title="Güçlü sinyaller:" reasons={privacy.strongReasons} />
      <ReasonList title="Zayıf sinyaller:" reasons={privacy.weakReasons} />
      <p>
        Giriş yapılmış, kişisel ya da sağlık verisi içeren sayfaları analiz etmeyin. Sayfanın herkese açık olduğundan
        eminseniz devam edebilirsiniz: LLM'e yalnızca maskelenmiş öğe envanteri gider ve onayınız rapora kaydedilir.
      </p>
      <label className="row">
        <input type="checkbox" checked={privacy.consentGiven} onChange={(e) => onConsentChange(e.target.checked)} />
        <span>
          {uncertain
            ? 'Sayfanın herkese açık olduğunu kontrol ettim; maskelenmiş özetin gönderilmesine açıkça onay veriyorum.'
            : 'Sayfanın hassas olabileceğini anlıyorum; maskelenmiş özetin gönderilmesine açıkça onay veriyorum.'}
        </span>
      </label>
      {privacy.consentGiven && privacy.consentAt && <p className="muted">Onay zamanı: {privacy.consentAt}</p>}
    </div>
  )
}
