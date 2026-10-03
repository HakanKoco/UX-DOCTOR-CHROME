import { useState } from 'react'
import { CATEGORY_LABELS, DETERMINISTIC_CATEGORY_IDS } from '@/shared/axeMapping'
import type { DeterministicRaw, PageInfo } from '@/shared/contentApi'
import type { Finding, PrivacyRecord } from '@/shared/report'
import { detectSensitivePage } from '@/shared/sensitivity'
import { requestSiteAccess } from '@/shared/sitePermissions'
import FindingList, { type FindingGroup } from './FindingList'
import ManualReviewList from './ManualReviewList'
import PrivacyPanel from './PrivacyPanel'
import SettingsSummary, { useSettings } from './SettingsSummary'
import { TabAccessError, callContent, getActiveTab } from './tabBridge'

export default function App() {
  const settings = useSettings()
  const [tabId, setTabId] = useState<number | null>(null)
  const [page, setPage] = useState<PageInfo | null>(null)
  const [det, setDet] = useState<DeterministicRaw | null>(null)
  const [privacy, setPrivacy] = useState<PrivacyRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; canRequestPermission: boolean } | null>(null)

  async function analyze() {
    setBusy(true)
    setError(null)
    try {
      const tab = await getActiveTab()
      setTabId(tab.id)
      const info = await callContent(tab.id, 'getPageInfo')
      setPage(info)
      const signals = await callContent(tab.id, 'collectSensitivitySignals')
      const sensitivity = detectSensitivePage(signals)
      setPrivacy({ sensitive: sensitivity.sensitive, reasons: sensitivity.reasons, consentGiven: false })
      setDet(await callContent(tab.id, 'runDeterministic'))
    } catch (e) {
      setError({
        text: e instanceof Error ? e.message : String(e),
        canRequestPermission: e instanceof TabAccessError && e.canRequestPermission,
      })
    } finally {
      setBusy(false)
    }
  }

  async function highlightFindings(findings: Finding[], scroll: boolean) {
    if (tabId === null) return
    try {
      const res = await callContent(
        tabId,
        'highlight',
        findings.map((f) => ({ selector: f.selector, label: f.elementId ? `${f.elementId} · ${f.rule}` : f.rule, severity: f.severity })),
        scroll,
      )
      if (res.missing.length > 0) setError({ text: `${res.missing.length} öğe sayfada bulunamadı (sayfa değişmiş olabilir).`, canRequestPermission: false })
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : String(e), canRequestPermission: false })
    }
  }

  const groups: FindingGroup[] = DETERMINISTIC_CATEGORY_IDS.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    findings: det?.findings.filter((f) => f.category === id) ?? [],
  }))

  return (
    <main>
      <h1>UX Doktor</h1>
      <SettingsSummary settings={settings} />
      <div className="row toolbar">
        <button type="button" onClick={analyze} disabled={busy}>
          {busy ? 'Analiz ediliyor…' : 'Bu sayfayı analiz et'}
        </button>
        {tabId !== null && (
          <button type="button" className="secondary" onClick={() => callContent(tabId, 'clearHighlights').catch(() => undefined)}>
            Vurguları temizle
          </button>
        )}
      </div>

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
          <FindingList groups={groups} onHighlight={highlightFindings} emptyText="WCAG 2.2 AA ihlali bulunmadı." />
          <ManualReviewList
            items={det.manualReview}
            onHighlight={(selector) => highlightFindings([{ selector, rule: 'Elle incelenmeli', severity: 'Orta', evidence: { highlightable: true } } as Finding], true)}
          />
        </section>
      )}
    </main>
  )
}
