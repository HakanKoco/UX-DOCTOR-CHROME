import { useEffect, useState, type FormEvent } from 'react'
import DiagnosticsDetails from '@/shared/DiagnosticsDetails'
import type { GeminiDiagnostics } from '@/shared/geminiResponse'
import { interpretVerifyResponse, sendToBackground } from '@/shared/messages'
import {
  CLAUDE_MODEL_OPTIONS,
  GEMINI_MODEL_OPTIONS,
  PROVIDER_LABELS,
  isClaudeModelId,
  isGeminiModelId,
  type Provider,
} from '@/shared/models'
import {
  deleteApiKey,
  getPublicSettings,
  looksLikeApiKey,
  saveApiKey,
  saveClaudeModel,
  saveGeminiModel,
  saveProvider,
  type PublicSettings,
} from '@/shared/settings'
import { hasSiteAccess, revokeSiteAccess } from '@/shared/sitePermissions'

type Status = { kind: 'info' | 'ok' | 'error'; text: string; diagnostics?: GeminiDiagnostics } | null

const KEY_INFO: Record<Provider, { title: string; host: string; placeholder: string; formatHint: string }> = {
  claude: {
    title: 'Claude API anahtarı',
    host: 'api.anthropic.com',
    placeholder: 'sk-ant-…',
    formatHint: 'Bu bir Claude API anahtarına benzemiyor ("sk-ant-" ile başlamalı).',
  },
  gemini: {
    title: 'Gemini API anahtarı',
    host: 'generativelanguage.googleapis.com',
    placeholder: 'Google AI Studio anahtarı',
    formatHint: 'Bu bir API anahtarına benzemiyor (boşluk içermemeli, en az 21 karakter olmalı).',
  },
}

function KeyCard({
  provider,
  hasKey,
  busy,
  onSaved,
  onDeleted,
  onVerify,
  setStatus,
}: {
  provider: Provider
  hasKey: boolean
  busy: boolean
  onSaved: () => void
  onDeleted: () => void
  onVerify: () => void
  setStatus: (s: Status) => void
}) {
  const [keyInput, setKeyInput] = useState('')
  const info = KEY_INFO[provider]
  const inputId = `api-key-${provider}`

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (!looksLikeApiKey(provider, keyInput)) {
      setStatus({ kind: 'error', text: info.formatHint })
      return
    }
    await saveApiKey(provider, keyInput)
    setKeyInput('')
    onSaved()
    setStatus({ kind: 'ok', text: `${info.title} bu cihazda kaydedildi (chrome.storage.local).` })
  }

  async function onDelete() {
    await deleteApiKey(provider)
    onDeleted()
    setStatus({ kind: 'info', text: `${info.title} silindi.` })
  }

  return (
    <section className="card" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`}>{info.title}</h2>
      <p>
        Durum: <strong>{hasKey ? 'Anahtar kayıtlı' : 'Anahtar yok'}</strong>
      </p>
      <p className="muted">
        Anahtar yalnızca bu tarayıcıda, <code>chrome.storage.local</code> içinde saklanır. Senkronize edilmez, dosyaya
        yazılmaz ve yalnızca {provider === 'claude' ? 'Claude API' : 'Gemini API'}'ye ({info.host}) gönderilir.
      </p>
      <form onSubmit={onSave} className="stack">
        <label htmlFor={inputId}>{hasKey ? 'Yeni anahtarla değiştir' : 'Anahtar'}</label>
        <input
          id={inputId}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={info.placeholder}
        />
        <div className="row">
          <button type="submit" disabled={keyInput.trim().length === 0}>
            Kaydet
          </button>
          {hasKey && (
            <>
              <button type="button" onClick={onVerify} disabled={busy}>
                Anahtarı doğrula
              </button>
              <button type="button" className="danger" onClick={onDelete}>
                Anahtarı sil
              </button>
            </>
          )}
        </div>
      </form>
    </section>
  )
}

export default function App() {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [siteAccess, setSiteAccess] = useState(false)

  const reload = () => getPublicSettings().then(setSettings)

  useEffect(() => {
    reload()
    hasSiteAccess().then(setSiteAccess)
  }, [])

  async function onRevokeSiteAccess() {
    await revokeSiteAccess()
    setSiteAccess(await hasSiteAccess())
    setStatus({ kind: 'info', text: 'Site erişim izni geri alındı. Analiz artık yalnızca simgeye tıklanan sekmede (activeTab) çalışır.' })
  }

  async function onProviderChange(provider: Provider) {
    await saveProvider(provider)
    await reload()
    setStatus({ kind: 'ok', text: `Sağlayıcı kaydedildi: ${PROVIDER_LABELS[provider]}.` })
  }

  async function onModelChange(value: string) {
    if (isClaudeModelId(value)) await saveClaudeModel(value)
    else if (isGeminiModelId(value)) await saveGeminiModel(value)
    else return
    await reload()
    setStatus({ kind: 'ok', text: 'Model kaydedildi.' })
  }

  async function onVerify(provider: Provider) {
    setBusy(true)
    setStatus({ kind: 'info', text: 'Doğrulanıyor…' })
    try {
      const result = interpretVerifyResponse(provider, await sendToBackground({ type: 'verify-key', provider }))
      setStatus({ kind: result.ok ? 'ok' : 'error', text: result.message, diagnostics: result.diagnostics })
    } finally {
      setBusy(false)
    }
  }

  const provider = settings?.provider ?? null

  return (
    <main className="page">
      <h1>UX Doktor — Ayarlar</h1>

      <section className="card" aria-labelledby="provider-title">
        <h2 id="provider-title">LLM sağlayıcısı</h2>
        <fieldset className="stack" disabled={!settings}>
          <legend>Norman ilkeleri analizinde kullanılacak sağlayıcı</legend>
          {(['claude', 'gemini'] as const).map((p) => (
            <label key={p}>
              <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => onProviderChange(p)} />{' '}
              {PROVIDER_LABELS[p]}
            </label>
          ))}
        </fieldset>
        {provider === 'gemini' && (
          <p className="warning" role="note">
            Gemini ücretsiz katmanında Google, gönderilen içeriği ve yanıtları ürünlerini ve makine öğrenmesi
            teknolojilerini (model eğitimi dahil) geliştirmek için kullanabilir ve insan incelemeciler girdi/çıktıları
            okuyabilir. Eklenti yalnızca maskelenmiş öğe
            envanterini gönderir; yine de hassas sayfalarda göndermeyin.
          </p>
        )}
      </section>

      {settings && (
        <>
          <KeyCard
            provider="claude"
            hasKey={settings.hasClaudeKey}
            busy={busy}
            onSaved={reload}
            onDeleted={reload}
            onVerify={() => onVerify('claude')}
            setStatus={setStatus}
          />
          <KeyCard
            provider="gemini"
            hasKey={settings.hasGeminiKey}
            busy={busy}
            onSaved={reload}
            onDeleted={reload}
            onVerify={() => onVerify('gemini')}
            setStatus={setStatus}
          />
        </>
      )}

      <section className="card" aria-labelledby="model-title">
        <h2 id="model-title">Model</h2>
        <label htmlFor="claude-model">Claude modeli</label>
        <select
          id="claude-model"
          value={settings?.claudeModel ?? ''}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={!settings}
        >
          {CLAUDE_MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="muted">
          Tutarlılık için Opus 5.5 ve Sonnet 5.5'te düşünme düzeyi (effort) sabit "medium" gönderilir; bu modeller
          temperature parametresini kabul etmez. Haiku 4.5'te temperature 0 gönderilir.
        </p>
        <label htmlFor="gemini-model">Gemini modeli</label>
        <select
          id="gemini-model"
          value={settings?.geminiModel ?? ''}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={!settings}
        >
          {GEMINI_MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="muted">
          Gemini'de düşünme düzeyi (thinkingLevel) sabit "MEDIUM" gönderilir. Temperature, Google'ın Gemini 3 önerisine
          uyularak varsayılan 1.0'da tutulur (1.0 altı değerlerde döngü ve performans düşüşü uyarısı var). Analizde
          yalnızca yukarıda seçili sağlayıcının modeli kullanılır.
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
      {status?.diagnostics && <DiagnosticsDetails diagnostics={status.diagnostics} />}
    </main>
  )
}
