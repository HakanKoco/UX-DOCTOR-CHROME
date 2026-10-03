import { useEffect, useState, type FormEvent } from 'react'
import { MODEL_OPTIONS, isModelId, type ModelId } from '@/shared/models'
import { sendToBackground } from '@/shared/messages'
import { deleteApiKey, getPublicSettings, looksLikeApiKey, saveApiKey, saveModel } from '@/shared/settings'
import { hasSiteAccess, revokeSiteAccess } from '@/shared/sitePermissions'

type Status = { kind: 'info' | 'ok' | 'error'; text: string } | null

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [model, setModel] = useState<ModelId | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [siteAccess, setSiteAccess] = useState(false)

  useEffect(() => {
    getPublicSettings().then((s) => {
      setHasApiKey(s.hasApiKey)
      setModel(s.model)
    })
    hasSiteAccess().then(setSiteAccess)
  }, [])

  async function onRevokeSiteAccess() {
    await revokeSiteAccess()
    setSiteAccess(await hasSiteAccess())
    setStatus({ kind: 'info', text: 'Site erişim izni geri alındı. Analiz artık yalnızca simgeye tıklanan sekmede (activeTab) çalışır.' })
  }

  async function onSaveKey(event: FormEvent) {
    event.preventDefault()
    if (!looksLikeApiKey(keyInput)) {
      setStatus({ kind: 'error', text: 'Bu bir Claude API anahtarına benzemiyor ("sk-ant-" ile başlamalı).' })
      return
    }
    await saveApiKey(keyInput)
    setKeyInput('')
    setHasApiKey(true)
    setStatus({ kind: 'ok', text: 'Anahtar bu cihazda kaydedildi (chrome.storage.local).' })
  }

  async function onDeleteKey() {
    await deleteApiKey()
    setHasApiKey(false)
    setStatus({ kind: 'info', text: 'Anahtar silindi.' })
  }

  async function onModelChange(value: string) {
    if (!isModelId(value)) return
    setModel(value)
    await saveModel(value)
    setStatus({ kind: 'ok', text: 'Model kaydedildi.' })
  }

  async function onVerify() {
    setBusy(true)
    setStatus({ kind: 'info', text: 'Doğrulanıyor…' })
    try {
      const result = await sendToBackground({ type: 'verify-key' })
      setStatus({ kind: result.ok ? 'ok' : 'error', text: result.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <h1>UX Doktor — Ayarlar</h1>

      <section className="card" aria-labelledby="key-title">
        <h2 id="key-title">Claude API anahtarı</h2>
        <p>
          Durum: <strong>{hasApiKey ? 'Anahtar kayıtlı' : 'Anahtar yok'}</strong>
        </p>
        <p className="muted">
          Anahtar yalnızca bu tarayıcıda, <code>chrome.storage.local</code> içinde saklanır. Senkronize edilmez,
          dosyaya yazılmaz ve yalnızca Claude API'ye (api.anthropic.com) gönderilir.
        </p>
        <form onSubmit={onSaveKey} className="stack">
          <label htmlFor="api-key">{hasApiKey ? 'Yeni anahtarla değiştir' : 'Anahtar'}</label>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-…"
          />
          <div className="row">
            <button type="submit" disabled={keyInput.trim().length === 0}>
              Kaydet
            </button>
            {hasApiKey && (
              <>
                <button type="button" onClick={onVerify} disabled={busy}>
                  Anahtarı doğrula
                </button>
                <button type="button" className="danger" onClick={onDeleteKey}>
                  Anahtarı sil
                </button>
              </>
            )}
          </div>
        </form>
      </section>

      <section className="card" aria-labelledby="model-title">
        <h2 id="model-title">Model</h2>
        <label htmlFor="model">Analizde kullanılacak model</label>
        <select id="model" value={model ?? ''} onChange={(e) => onModelChange(e.target.value)} disabled={!model}>
          {MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="muted">
          Tutarlılık için Opus 5.5 ve Sonnet 5.5'te düşünme düzeyi (effort) sabit "medium" gönderilir; bu modeller
          temperature parametresini kabul etmez. Haiku 4.5'te temperature 0 gönderilir.
        </p>
      </section>

      <section className="card" aria-labelledby="access-title">
        <h2 id="access-title">Site erişimi</h2>
        <p>
          Durum: <strong>{siteAccess ? 'Tüm http/https sitelerine erişim verilmiş' : 'Yalnızca simgeye tıklanan sekme (activeTab)'}</strong>
        </p>
        <p className="muted">
          Eklenti kurulumda site erişimi istemez. activeTab yetmediğinde yan paneldeki düğmeyle siz verirsiniz; buradan
          geri alabilirsiniz.
        </p>
        {siteAccess && (
          <button type="button" className="danger" onClick={onRevokeSiteAccess}>
            Site erişim iznini geri al
          </button>
        )}
      </section>

      <p role="status" aria-live="polite" className={status ? `status ${status.kind}` : 'status'}>
        {status?.text}
      </p>
    </main>
  )
}
