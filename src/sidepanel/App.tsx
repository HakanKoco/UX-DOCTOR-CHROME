import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_LABELS, DETERMINISTIC_CATEGORY_IDS } from '@/shared/axeMapping'
import type { DeterministicRaw, PageInfo } from '@/shared/contentApi'
import type { Inventory } from '@/shared/inventory'
import { PROVIDER_API_NAMES, buildLlmRequest, buildUserPayload, requestTransportPreview, type LlmRequest } from '@/shared/llmRequest'
import type { Finding, LlmResult, PrivacyRecord } from '@/shared/report'
import { PRINCIPLE_IDS, PRINCIPLE_LABELS } from '@/shared/rubric'
import { buildReport, slugForFile, timestampForFile } from '@/shared/reportBuilder'
import { MAX_RETRIES, RUN_INTERVAL_MS } from '@/shared/retry'
import {
  attemptedRuns,
  clearProgress,
  isComplete,
  loadProgress,
  newProgress,
  nextRunIndex,
  remainingRuns,
  samePage,
  saveProgress,
  withFailure,
  withPause,
  withResult,
  type ConsistencyProgress,
} from '@/shared/consistencyProgress'
import { FALLBACK_GEMINI_MODEL } from '@/shared/models'
import { detectSensitivePage, isLocked } from '@/shared/sensitivity'
import { keyStatus } from '@/shared/settings'
import { requestSiteAccess } from '@/shared/sitePermissions'
import {
  buildConsistencyExport,
  buildHallucinationReview,
  type ConsistencyExport,
} from '@/shared/validationExports'
import DiagnosticsDetails from '@/shared/DiagnosticsDetails'
import type { GeminiDiagnostics } from '@/shared/geminiResponse'
import ConfirmSendDialog from './ConfirmSendDialog'
import FindingList, { type FindingGroup } from './FindingList'
import LlmDetails from './LlmDetails'
import ManualReviewList from './ManualReviewList'
import PrivacyPanel from './PrivacyPanel'
import ScoreSummary from './ScoreSummary'
import TopIssues from './TopIssues'
import SettingsSummary, { useSettings } from './SettingsSummary'
import ValidationTools from './ValidationTools'
import { downloadJson } from './download'
import {
  LlmCallError,
  LlmCancelledError,
  buildLlmResult,
  callLlmWithRetry,
  isTransientFailure,
  waitWithCountdown,
  type RetryState,
} from './llmClient'
import ConsistencyResumeCard from './ConsistencyResumeCard'
import { captureFindingScreenshot } from './screenshot'
import { TabAccessError, callContent, getActiveTab } from './tabBridge'

interface PendingSend {
  request: LlmRequest
  inventory: Inventory
  /** Bu onayla gönderilecek istek sayısı. */
  runs: number
  /**
   * single: tek analiz; consistency: yeni tutarlılık testi; resume: yarım kalan testin kalan çalıştırmaları;
   * fallback: asıl model geçici hata verdikten sonra elle onaylı yedek model denemesi (tutarlılığa girmez).
   */
  mode: 'single' | 'consistency' | 'resume' | 'fallback'
  fallbackFrom?: { fromModel: string; reason: string }
}

/** Asıl model geçici hatayla yanıt veremedi; kullanıcıya "Flash-Lite ile dene" önerilir. */
interface FallbackOffer {
  inventory: Inventory
  fromModel: string
  reason: string
}

function retryText(prefix: string, s: RetryState): string {
  const cause = s.quotaLabel ? `${s.status} (${s.quotaLabel})` : `${s.status ?? '?'}`
  const basis = s.basis === 'server' ? ' (Google\'ın önerdiği bekleme)' : ''
  return `${prefix} — ${cause} hatası; yeniden deneniyor (${s.attempt}/${s.maxRetries}), sonraki deneme ${s.secondsLeft} sn sonra${basis}.`
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function exportOf(record: ConsistencyProgress): ConsistencyExport {
  return buildConsistencyExport({
    page: record.page,
    request: record.request,
    inventory: record.inventory,
    requestedRuns: record.requestedRuns,
    results: record.results,
    failures: record.failures,
  })
}

type UiError = { text: string; canRequestPermission: boolean; diagnostics?: GeminiDiagnostics } | null

function toUiError(e: unknown): UiError {
  return {
    text: e instanceof Error ? e.message : String(e),
    canRequestPermission: e instanceof TabAccessError && e.canRequestPermission,
    ...(e instanceof LlmCallError && e.diagnostics ? { diagnostics: e.diagnostics } : {}),
  }
}

export default function App() {
  const settings = useSettings()
  const [tabId, setTabId] = useState<number | null>(null)
  const [windowId, setWindowId] = useState<number | null>(null)
  const [page, setPage] = useState<PageInfo | null>(null)
  const [det, setDet] = useState<DeterministicRaw | null>(null)
  const [privacy, setPrivacy] = useState<PrivacyRecord | null>(null)
  const [llm, setLlm] = useState<LlmResult | null>(null)
  /** LLM'e gerçekten gönderilen istek (rapora aynen yazılır). */
  const [sentBody, setSentBody] = useState<LlmRequest | null>(null)
  /** LLM analizinde kullanılan yerel envanter (halüsinasyon elle doğrulama listesi için). */
  const [llmInventory, setLlmInventory] = useState<Inventory | null>(null)
  const [consistency, setConsistency] = useState<ConsistencyExport | null>(null)
  /** Tutarlılık testinin chrome.storage.local'deki ilerleme kaydı (panel kapansa da kalır). */
  const [progressRecord, setProgressRecord] = useState<ConsistencyProgress | null>(null)
  const [fallbackOffer, setFallbackOffer] = useState<FallbackOffer | null>(null)
  const [pending, setPending] = useState<PendingSend | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<UiError>(null)
  /** Süren LLM işini (bekleme/yeniden deneme) durdurmak için. */
  const abortRef = useRef<AbortController | null>(null)
  const [cancellable, setCancellable] = useState(false)

  // Panel açılınca önceki (yarım kalmış ya da dışa aktarılmamış) tutarlılık testi kaydı yüklenir.
  useEffect(() => {
    loadProgress()
      .then((record) => {
        setProgressRecord(record)
        if (record) setConsistency(exportOf(record))
      })
      .catch(() => undefined)
  }, [])

  function startCancellable(): AbortController {
    const controller = new AbortController()
    abortRef.current = controller
    setCancellable(true)
    return controller
  }

  function endCancellable() {
    abortRef.current = null
    setCancellable(false)
  }

  /** Asıl Gemini modeli geçici hatayla yanıt veremediyse elle onaylı yedek model denemesini önerir. */
  function offerFallback(request: LlmRequest, inventory: Inventory, e: unknown) {
    if (e instanceof LlmCancelledError) return
    if (request.provider !== 'gemini' || request.model === FALLBACK_GEMINI_MODEL) return
    setFallbackOffer({ inventory, fromModel: request.model, reason: errorText(e) })
  }

  async function analyze() {
    setBusy('Deterministik analiz çalışıyor…')
    setError(null)
    setLlm(null)
    setSentBody(null)
    setLlmInventory(null)
    setFallbackOffer(null)
    // Tutarlılık kaydı silinmez (yarım test sonra sürdürülebilir); yalnızca görünüm kayda göre yenilenir.
    setConsistency(progressRecord ? exportOf(progressRecord) : null)
    try {
      const tab = await getActiveTab()
      setTabId(tab.id)
      setWindowId(tab.windowId)
      setPage(await callContent(tab.id, 'getPageInfo'))
      const sensitivity = detectSensitivePage(await callContent(tab.id, 'collectSensitivitySignals'))
      setPrivacy({
        level: sensitivity.level,
        sensitive: sensitivity.level === 'sensitive',
        reasons: [...sensitivity.strongReasons, ...sensitivity.weakReasons],
        strongReasons: sensitivity.strongReasons,
        weakReasons: sensitivity.weakReasons,
        consentGiven: false,
      })
      setDet(await callContent(tab.id, 'runDeterministic'))
    } catch (e) {
      setError(toUiError(e))
    } finally {
      setBusy(null)
    }
  }

  async function prepareLlm(runs = 1) {
    if (tabId === null || !settings) return
    setError(null)
    setBusy('Öğe envanteri hazırlanıyor…')
    try {
      const inventory = await callContent(tabId, 'buildInventory')
      setPending({
        request: buildLlmRequest(settings.model, inventory),
        inventory,
        runs,
        mode: runs > 1 ? 'consistency' : 'single',
      })
    } catch (e) {
      setError(toUiError(e))
    } finally {
      setBusy(null)
    }
  }

  /** "Flash-Lite ile dene": yeni istek gövdesi yine onay ekranında gösterilir; tutarlılık kaydına dokunulmaz. */
  function prepareFallback() {
    if (!fallbackOffer) return
    setError(null)
    setPending({
      request: buildLlmRequest(FALLBACK_GEMINI_MODEL, fallbackOffer.inventory),
      inventory: fallbackOffer.inventory,
      runs: 1,
      mode: 'fallback',
      fallbackFrom: { fromModel: fallbackOffer.fromModel, reason: fallbackOffer.reason },
    })
  }

  async function sendLlm() {
    if (!pending) return
    const p = pending
    setPending(null)
    if (p.mode === 'consistency') return startConsistency(p.request, p.inventory, p.runs)
    if (p.mode === 'resume') return progressRecord ? continueConsistency(progressRecord) : undefined
    return runSingle(p)
  }

  /** Tek analiz (ya da elle onaylı yedek model denemesi): 429/503'te görünür geri sayımla yeniden denenir. */
  async function runSingle(p: PendingSend) {
    const { request, inventory } = p
    const label = `${PROVIDER_API_NAMES[request.provider]} (${request.model})`
    setFallbackOffer(null)
    setError(null)
    setBusy(`${label} yanıtı bekleniyor (bir dakikayı bulabilir)…`)
    const controller = startCancellable()
    try {
      const { call, retries } = await callLlmWithRetry(request, (s) => setBusy(retryText(label, s)), controller.signal)
      const result = await buildLlmResult(call, request, inventory, tabId, retries, p.fallbackFrom)
      // Şema hatasında da sonuç saklanır: ham yanıt rapordaki çalıştırma kaydında kalır.
      setLlm(result)
      setSentBody(request)
      setLlmInventory(inventory)
      if (result.schemaError) setError({ text: result.schemaError, canRequestPermission: false })
    } catch (e) {
      setError(toUiError(e))
      offerFallback(request, inventory, e)
    } finally {
      endCancellable()
      setBusy(null)
    }
  }

  /** Yeni tutarlılık testi: varsa eski kayıt silinir (onay ekranında yazıyor), yeni kayıt hemen yazılır. */
  async function startConsistency(request: LlmRequest, inventory: Inventory, runs: number) {
    if (!page) return
    const record = newProgress({ page, request, inventory, requestedRuns: runs })
    await saveProgress(record)
    await continueConsistency(record)
  }

  /**
   * Tutarlılık testi: aynı gövde sırayla gönderilir (kullanıcı onay ekranında sayıyı görerek onayladı).
   * Çalıştırmalar arasında sağlayıcıya göre beklenir (Gemini: 15 sn), 429/503'te görünür geri sayımla yeniden
   * denenir (src/shared/retry.ts). Her biten çalıştırma kayda yazılır. Denemeler tükenirse, bağlantı koparsa ya da
   * kullanıcı durdurursa test başarısız sayılmaz, DURAKLATILIR; "Kaldığı yerden devam et" ile sürer.
   */
  async function continueConsistency(initial: ConsistencyProgress) {
    let record = initial
    const { request, inventory } = record
    const interval = RUN_INTERVAL_MS[request.provider]
    const persist = async () => {
      setProgressRecord(record)
      setConsistency(exportOf(record))
      await saveProgress(record)
    }
    setError(null)
    setFallbackOffer(null)
    await persist()
    const controller = startCancellable()
    try {
      while (!isComplete(record)) {
        const i = nextRunIndex(record)
        const total = record.requestedRuns
        const prefix = `Tutarlılık testi: ${i}/${total}. çalıştırma`
        try {
          if (controller.signal.aborted) throw new LlmCancelledError()
          if (attemptedRuns(record) > 0 && interval > 0) {
            await waitWithCountdown(
              interval,
              (s) => setBusy(`Tutarlılık testi: istek sınırı için bekleniyor, ${i}/${total}. çalıştırma ${s} sn sonra…`),
              controller.signal,
            )
          }
          setBusy(`${prefix} bekleniyor…`)
          const { call, retries } = await callLlmWithRetry(request, (s) => setBusy(retryText(prefix, s)), controller.signal)
          const result = await buildLlmResult(call, request, inventory, tabId, retries)
          // Şemaya uymayan yanıt istatistiğe girmez; ham yanıtıyla birlikte başarısız çalıştırma olarak kaydedilir.
          record = result.schemaError
            ? withFailure(record, {
                runIndex: i,
                timestamp: result.run.timestamp,
                error: result.schemaError,
                rawResponse: result.run.rawResponse,
              })
            : withResult(record, i, result)
        } catch (e) {
          if (isTransientFailure(e)) {
            record = withPause(record, errorText(e))
            await persist()
            setError({
              text: `Tutarlılık testi duraklatıldı (${attemptedRuns(record)}/${total} bitti): ${errorText(e)} Biten çalıştırmalar kaydedildi; "Kaldığı yerden devam et" ile sürdürebilirsiniz.`,
              canRequestPermission: false,
              ...(e instanceof LlmCallError && e.diagnostics ? { diagnostics: e.diagnostics } : {}),
            })
            offerFallback(request, inventory, e)
            break
          }
          record = withFailure(record, { runIndex: i, timestamp: new Date().toISOString(), error: errorText(e) })
        }
        await persist()
      }
    } finally {
      endCancellable()
      setBusy(null)
    }
    // İlk başarılı çalıştırma, rapor görünümü için LLM sonucu olarak da gösterilir (rapora o yazılır).
    const first = record.results[0]
    if (first) {
      setLlm(first.result)
      setSentBody(request)
      setLlmInventory(inventory)
    }
    if (isComplete(record) && record.results.length === 0 && record.failures[0]) {
      setError({ text: record.failures[0].error, canRequestPermission: false })
    }
  }

  /** Yarım kalan testi sürdürmeden önce: aynı sayfada mıyız, sayfa hâlâ kilitsiz mi? Sonra onay ekranı açılır. */
  async function prepareResume() {
    const record = progressRecord
    if (!record || isComplete(record)) return
    setError(null)
    setBusy('Sayfa kontrol ediliyor…')
    try {
      const tab = await getActiveTab()
      const info = await callContent(tab.id, 'getPageInfo')
      if (!samePage(info.url, record.page.url)) {
        throw new Error(`Devam etmek için testin başladığı sayfayı açın: ${record.page.url}`)
      }
      const sensitivity = detectSensitivePage(await callContent(tab.id, 'collectSensitivitySignals'))
      const consented = privacy?.consentGiven === true && page !== null && samePage(page.url, record.page.url)
      if (isLocked(sensitivity.level) && !consented) {
        throw new Error('Sayfa hassas ya da belirsiz görünüyor. Önce "Bu sayfayı analiz et" ile analiz edip gizlilik onayını verin.')
      }
      setTabId(tab.id)
      setWindowId(tab.windowId)
      setPending({ request: record.request, inventory: record.inventory, runs: remainingRuns(record), mode: 'resume' })
    } catch (e) {
      setError(toUiError(e))
    } finally {
      setBusy(null)
    }
  }

  async function discardProgress() {
    await clearProgress()
    setProgressRecord(null)
    setConsistency(null)
  }

  function exportConsistency() {
    if (!consistency) return
    const host = new URL(consistency.page.url).host
    downloadJson(`ux-doktor-tutarlilik-${slugForFile(host)}-${timestampForFile()}.json`, consistency)
  }

  function exportHallucination() {
    if (!llm || !page) return
    downloadJson(
      `ux-doktor-halusinasyon-${slugForFile(page.host)}-${timestampForFile()}.json`,
      buildHallucinationReview({ page, llm, inventory: llmInventory }),
    )
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

  async function screenshotFinding(finding: Finding) {
    if (tabId === null || windowId === null) return
    setError(null)
    setBusy('Kanıt görüntüsü alınıyor…')
    try {
      const shot = await captureFindingScreenshot(tabId, windowId, finding)
      const attach = (list: Finding[]) =>
        list.map((f) => (f.id === finding.id ? { ...f, evidence: { ...f.evidence, screenshot: shot } } : f))
      if (finding.source === 'deterministic') setDet((d) => (d ? { ...d, findings: attach(d.findings) } : d))
      else setLlm((l) => (l ? { ...l, findings: attach(l.findings) } : l))
    } catch (e) {
      setError(toUiError(e))
    } finally {
      setBusy(null)
    }
  }

  const report = useMemo(
    () =>
      page && privacy && det
        ? buildReport({ toolVersion: chrome.runtime.getManifest().version, page, privacy, det, llm, llmRequest: sentBody })
        : null,
    [page, privacy, det, llm, sentBody],
  )

  function exportReport() {
    if (!report || !page) return
    downloadJson(`ux-doktor-${slugForFile(page.host)}-${timestampForFile()}.json`, report)
  }

  const llmLocked = !!privacy && isLocked(privacy.level) && !privacy.consentGiven
  const keyState = settings ? keyStatus(settings) : null
  const llmDisabledReason = !keyState
    ? 'Ayarlar yükleniyor…'
    : !keyState.ok
      ? keyState.text
      : llmLocked
        ? privacy?.level === 'uncertain'
          ? 'Belirsiz sayfa: gönderim kilitli; yukarıdaki onay kutusuyla açılır.'
          : 'Hassas sayfa: gönderim kilitli (yukarıdaki onay kutusu).'
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
      {cancellable && (
        <div className="row">
          <button type="button" className="secondary" onClick={() => abortRef.current?.abort()}>
            Durdur
          </button>
          <span className="muted">Süren istek bitince durur; tutarlılık testi kaldığı yerden sürdürülebilir.</span>
        </div>
      )}

      {error && (
        <div className="error-box" role="alert">
          <p>{error.text}</p>
          {error.diagnostics && <DiagnosticsDetails diagnostics={error.diagnostics} />}
          {error.canRequestPermission && (
            <button type="button" onClick={() => requestSiteAccess().then((ok) => { if (ok) void analyze() })}>
              Site erişim izni ver ve tekrar dene
            </button>
          )}
        </div>
      )}

      {fallbackOffer && busy === null && (
        <div className="warning" role="note">
          <p>
            <code>{fallbackOffer.fromModel}</code> şu an yanıt veremiyor. İsterseniz aynı envanteri{' '}
            <code>{FALLBACK_GEMINI_MODEL}</code> ile <strong>ayrı bir deneme</strong> olarak gönderebilirsiniz. Bu sonuç
            raporda model adıyla ve "elle onaylı yedek model" notuyla yazılır, tutarlılık testi istatistiğine girmez.
          </p>
          <div className="row">
            <button type="button" onClick={prepareFallback}>
              Flash-Lite ile dene
            </button>
            <button type="button" className="secondary" onClick={() => setFallbackOffer(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {progressRecord && (
        <ConsistencyResumeCard
          record={progressRecord}
          busy={busy !== null}
          onResume={prepareResume}
          onExport={exportConsistency}
          onDiscard={discardProgress}
        />
      )}

      {page && (
        <p className="muted">
          {page.title || '(başlıksız sayfa)'} — <code>{page.url}</code>
        </p>
      )}
      {page?.translation.detected && (
        <div className="warning" role="note">
          <p>
            <strong>Sayfa çevirisi açık; seçiciler kararsız olabilir.</strong> Çeviri DOM'u değiştirir ve sayfa dilini
            (lang) çeviri diline çevirir. Tekrarlanabilir sonuç için çeviriyi kapatıp sayfayı yenileyin ve yeniden analiz
            edin.
          </p>
          <ul>
            {page.translation.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {privacy && (
        <PrivacyPanel
          privacy={privacy}
          onConsentChange={(consent) =>
            setPrivacy({ ...privacy, consentGiven: consent, consentAt: consent ? new Date().toISOString() : undefined })
          }
        />
      )}

      {report && (
        <>
          <ScoreSummary scores={report.scores} />
          <TopIssues findings={[...report.deterministic.findings, ...(report.llm?.findings ?? [])]} onHighlight={highlightFindings} />
          <div className="row toolbar">
            <button type="button" onClick={exportReport}>
              Raporu JSON olarak indir
            </button>
          </div>
        </>
      )}

      {det && (
        <section aria-labelledby="det-title">
          <h2 id="det-title">Deterministik bulgular (axe-core {det.engineVersion})</h2>
          <FindingList groups={detGroups} onHighlight={highlightFindings} onScreenshot={screenshotFinding} emptyText="WCAG 2.2 AA ihlali bulunmadı." />
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
            <button type="button" onClick={() => prepareLlm(1)} disabled={busy !== null || llmDisabledReason !== null}>
              LLM analizi için gönderimi hazırla
            </button>
          </div>
          {llmDisabledReason && <p className="muted">{llmDisabledReason}</p>}
          {llm && (
            <>
              <LlmDetails llm={llm} />
              <FindingList groups={llmGroups} onHighlight={highlightFindings} onScreenshot={screenshotFinding} emptyText="LLM kanıtlı bir sorun bildirmedi." />
            </>
          )}
        </section>
      )}

      {det && (
        <ValidationTools
          disabledReason={llmDisabledReason}
          busy={busy !== null}
          progress={
            progressRecord
              ? { done: attemptedRuns(progressRecord), total: progressRecord.requestedRuns, failed: progressRecord.failures.length }
              : null
          }
          consistency={consistency}
          canExportHallucination={llm !== null}
          onStartConsistency={(runs) => prepareLlm(runs)}
          onExportConsistency={exportConsistency}
          onExportHallucination={exportHallucination}
        />
      )}

      {pending && (
        <ConfirmSendDialog
          provider={pending.request.provider}
          requestBody={pending.request.body}
          model={pending.request.model}
          runs={pending.runs}
          transport={requestTransportPreview(pending.request)}
          runIntervalMs={RUN_INTERVAL_MS[pending.request.provider]}
          maxRetries={MAX_RETRIES}
          note={
            pending.mode === 'resume'
              ? `Yarım kalan tutarlılık testinin kalan ${pending.runs} çalıştırması gönderilecek (toplam ${progressRecord?.requestedRuns ?? '?'}; biten çalıştırmalar korunur). Gövde, testin ilk onayındakiyle aynıdır.`
              : pending.mode === 'fallback'
                ? `Elle onaylı yedek model denemesi: ${pending.fallbackFrom?.fromModel} yanıt veremedi. Sonuç raporda bu model adıyla yazılır ve tutarlılık testi istatistiğine girmez.`
                : pending.mode === 'consistency' && progressRecord
                  ? 'Yeni test başlatılırsa önceki tutarlılık testi kaydı silinir. Önce dışa aktarmak isterseniz İptal deyin.'
                  : undefined
          }
          readableUserPayload={buildUserPayload(pending.inventory)}
          onSend={sendLlm}
          onCancel={() => setPending(null)}
        />
      )}
    </main>
  )
}
