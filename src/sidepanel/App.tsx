import { useState } from 'react'
import { CATEGORY_LABELS, DETERMINISTIC_CATEGORY_IDS } from '@/shared/axeMapping'
import type { DeterministicRaw, PageInfo } from '@/shared/contentApi'
import type { Inventory } from '@/shared/inventory'
import { buildRequestBody, buildUserPayload, requiredBetas, type LlmRequestBody } from '@/shared/llmRequest'
import type { Finding, LlmResult, PrivacyRecord } from '@/shared/report'
import { PRINCIPLE_IDS, PRINCIPLE_LABELS } from '@/shared/rubric'
import { detectSensitivePage } from '@/shared/sensitivity'
import { requestSiteAccess } from '@/shared/sitePermissions'
import ConfirmSendDialog from './ConfirmSendDialog'
import FindingList, { type FindingGroup } from './FindingList'
import LlmDetails from './LlmDetails'
import ManualReviewList from './ManualReviewList'
import PrivacyPanel from './PrivacyPanel'
import SettingsSummary, { useSettings } from './SettingsSummary'
import { buildLlmResult, callLlm } from './llmClient'
import { TabAccessError, callContent, getActiveTab } from './tabBridge'

interface PendingSend {
  body: LlmRequestBody
  inventory: Inventory
}

type UiError = { text: string; canRequestPermission: boolean } | null

function toUiError(e: unknown): UiError {
  return {
    text: e instanceof Error ? e.message : String(e),
    canRequestPermission: e instanceof TabAccessError && e.canRequestPermission,
  }
}

export default function App() {
  const settings = useSettings()
  const [tabId, setTabId] = useState<number | null>(null)
  const [page, setPage] = useState<PageInfo | null>(null)
  const [det, setDet] = useState<DeterministicRaw | null>(null)
  const [privacy, setPrivacy] = useState<PrivacyRecord | null>(null)
  const [llm, setLlm] = useState<LlmResult | null>(null)
  const [pending, setPending] = useState<PendingSend | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<UiError>(null)

  async function analyze() {
    setBusy('Deterministik analiz çalışıyor…')
    setError(null)
    setLlm(null)
    try {
      const tab = await getActiveTab()
      setTabId(tab.id)
      setPage(await callContent(tab.id, 'getPageInfo'))
      const sensitivity = detectSensitivePage(await callContent(tab.id, 'collectSensitivitySignals'))
      setPrivacy({ sensitive: sensitivity.sensitive, reasons: sensitivity.reasons, consentGiven: false })
      setDet(await callContent(tab.id, 'runDeterministic'))
    } catch (e) {
      setError(toUiError(e))
    } finally {
      setBusy(null)
    }
  }

  async function prepareLlm() {
    if (tabId === null || !settings) return
    setError(null)
    setBusy('Öğe envanteri hazırlanıyor…')
    try {
      const inventory = await callContent(tabId, 'buildInventory')
      setPending({ body: buildRequestBody(settings.model, inventory), inventory })
    } catch (e) {
      setError(toUiError(e))
    } finally {
      setBusy(null)
    }
  }

  async function sendLlm() {
    if (!pending) return
    const { body, inventory } = pending
    setPending(null)
    setBusy('Claude API yanıtı bekleniyor (bir dakikayı bulabilir)…')
    try {
      const call = await callLlm(body)
      setLlm(await buildLlmResult(call, body, inventory, tabId))
    } catch (e) {
      setError(toUiError(e))
    } finally {
      setBusy(null)
    }
  }

  async function highlightFindings(findings: Finding[], scroll: boolean) {
    if (tabId === null) return
    try {
      const items = findings.flatMap((f) => [
        { selector: f.selector, label: f.elementId ? `${f.elementId} · ${f.rule}` : f.rule, severity: f.severity },
        ...(f.evidence.relatedElements ?? []).map((r) => ({
          selector: r.selector,
          label: `${r.elementId} · ${f.rule}`,
          severity: f.severity,
        })),
      ])
      const res = await callContent(tabId, 'highlight', items, scroll)
      if (res.missing.length > 0) {
        setError({ text: `${res.missing.length} öğe sayfada bulunamadı (sayfa değişmiş olabilir).`, canRequestPermission: false })
      }
    } catch (e) {
      setError(toUiError(e))
    }
  }

  const llmLocked = !!privacy?.sensitive && !privacy.consentGiven
  const llmDisabledReason = !settings?.hasApiKey
    ? 'Önce ayarlardan API anahtarı girin.'
    : llmLocked
      ? 'Hassas sayfa: gönderim kilitli (yukarıdaki onay kutusu).'
      : null

  const detGroups: FindingGroup[] = DETERMINISTIC_CATEGORY_IDS.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    findings: det?.findings.filter((f) => f.category === id) ?? [],
  }))
  const llmGroups: FindingGroup[] = PRINCIPLE_IDS.map((id) => ({
    id,
    label: PRINCIPLE_LABELS[id],
    findings: llm?.findings.filter((f) => f.category === id) ?? [],
  }))

  return (
    <main>
      <h1>UX Doktor</h1>
      <SettingsSummary settings={settings} />
      <div className="row toolbar">
        <button type="button" onClick={analyze} disabled={busy !== null}>
          Bu sayfayı analiz et
        </button>
        {tabId !== null && (
          <button type="button" className="secondary" onClick={() => callContent(tabId, 'clearHighlights').catch(() => undefined)}>
            Vurguları temizle
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" className="muted">
        {busy}
      </p>

      {error && (
        <div className="error-box" role="alert">
          <p>{error.text}</p>
          {error.canRequestPermission && (
            <button type="button" onClick={() => requestSiteAccess().then((ok) => { if (ok) void analyze() })}>
              Site erişim izni ver ve tekrar dene
            </button>
          )}
        </div>
      )}

      {page && (
        <p className="muted">
          {page.title || '(başlıksız sayfa)'} — <code>{page.url}</code>
        </p>
      )}

      {privacy && (
        <PrivacyPanel
          privacy={privacy}
          onConsentChange={(consent) =>
            setPrivacy({ ...privacy, consentGiven: consent, consentAt: consent ? new Date().toISOString() : undefined })
          }
        />
      )}

      {det && (
        <section aria-labelledby="det-title">
          <h2 id="det-title">Deterministik bulgular (axe-core {det.engineVersion})</h2>
          <FindingList groups={detGroups} onHighlight={highlightFindings} emptyText="WCAG 2.2 AA ihlali bulunmadı." />
          <ManualReviewList
            items={det.manualReview}
            onHighlight={(selector) =>
              highlightFindings(
                [{ selector, rule: 'Elle incelenmeli', severity: 'Orta', evidence: { highlightable: true } } as Finding],
                true,
              )
            }
          />
        </section>
      )}

      {det && (
        <section aria-labelledby="llm-title">
          <h2 id="llm-title">Norman ilkeleri (LLM)</h2>
          <div className="row">
            <button type="button" onClick={prepareLlm} disabled={busy !== null || llmDisabledReason !== null}>
              LLM analizi için gönderimi hazırla
            </button>
          </div>
          {llmDisabledReason && <p className="muted">{llmDisabledReason}</p>}
          {llm && (
            <>
              <LlmDetails llm={llm} />
              <FindingList groups={llmGroups} onHighlight={highlightFindings} emptyText="LLM kanıtlı bir sorun bildirmedi." />
            </>
          )}
        </section>
      )}

      {pending && (
        <ConfirmSendDialog
          requestBody={pending.body}
          model={pending.body.model}
          runs={1}
          extraHeaders={requiredBetas(pending.body).length > 0 ? { 'anthropic-beta': requiredBetas(pending.body).join(',') } : {}}
          readableUserPayload={buildUserPayload(pending.inventory)}
          onSend={sendLlm}
          onCancel={() => setPending(null)}
        />
      )}
    </main>
  )
}
