import type { LlmResult, RubricAnswerValue } from '@/shared/report'
import { PRINCIPLE_IDS, PRINCIPLE_LABELS, questionById } from '@/shared/rubric'

const ANSWER_LABELS: Record<RubricAnswerValue, string> = { evet: 'Evet', hayir: 'Hayır', belirsiz: 'Belirsiz' }

function pct(value: number | null): string {
  return value === null ? '—' : `%${(value * 100).toFixed(1)}`
}

/** LLM çalıştırmasının ayrıntıları: model, kesilme, halüsinasyon istatistikleri ve rubrik cevapları. */
export default function LlmDetails({ llm }: { llm: LlmResult }) {
  const h = llm.hallucination
  return (
    <>
      <div className="card">
        <p>
          Sağlayıcı: <code>{llm.run.provider}</code> · Model: <code>{llm.run.requestedModel}</code>
          {llm.run.servedModel !== llm.run.requestedModel && (
            <>
              {' '}
              → yanıtlayan: <code>{llm.run.servedModel}</code>
            </>
          )}
          {llm.run.fallbackUsed && <strong> (sunucu taraflı yedek model kullanıldı)</strong>} · Prompt:{' '}
          <code>{llm.run.promptVersion}</code> · {(llm.run.durationMs / 1000).toFixed(1)} sn
          {llm.run.retries > 0 && <> · {llm.run.retries} yeniden deneme (429/503)</>}
          {llm.run.usage && (
            <>
              {' '}
              · {llm.run.usage.inputTokens} girdi / {llm.run.usage.outputTokens} çıktı token
            </>
          )}
        </p>
        <p>
          Envanter: {llm.inventory.includedCount} öğe gönderildi
          {llm.inventory.truncated && (
            <strong>
              {' '}
              — KESİLDİ: {llm.inventory.candidateCount} uygun öğeden yalnızca ilk {llm.inventory.limit} tanesi gönderildi.
            </strong>
          )}
        </p>
        <p>
          Halüsinasyon (otomatik kontrol): {h.invalidReferences} / {h.totalReferences} atıf envanterde yok (
          {pct(h.invalidReferenceRate)}); {h.droppedFindings} bulgu düşürüldü
          {h.invalidIds.length > 0 && (
            <>
              {' '}
              (geçersiz kimlikler: <code>{h.invalidIds.join(', ')}</code>)
            </>
          )}
          . Kanıtsız "hayır": {h.evidencelessNegatives}.
          {h.selectorCheck && (
            <>
              {' '}
              Seçici kontrolü: {h.selectorCheck.found}/{h.selectorCheck.checked} seçici sayfada tek öğeyle eşleşti.
            </>
          )}
        </p>
        {(llm.missingQuestionIds.length > 0 || llm.ignoredAnswers > 0) && (
          <p>
            Cevapsız sorular: {llm.missingQuestionIds.join(', ') || 'yok'} · Yok sayılan cevap: {llm.ignoredAnswers}
          </p>
        )}
      </div>

      <details className="group">
        <summary>Rubrik cevapları ({llm.answers.length} soru)</summary>
        {PRINCIPLE_IDS.map((principle) => (
          <div key={principle}>
            <h3>{PRINCIPLE_LABELS[principle]}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="score-table">
                <thead>
                  <tr>
                    <th scope="col">Soru</th>
                    <th scope="col">Cevap</th>
                    <th scope="col">Kanıt</th>
                    <th scope="col">Gerekçe</th>
                  </tr>
                </thead>
                <tbody>
                  {llm.answers
                    .filter((a) => a.principle === principle)
                    .map((a) => (
                      <tr key={a.questionId}>
                        <td>
                          <strong>{a.questionId}</strong> {questionById(a.questionId)?.question}
                        </td>
                        <td>
                          {ANSWER_LABELS[a.effectiveAnswer]}
                          {a.rawAnswer !== a.effectiveAnswer && (
                            <span className="muted"> (LLM: {ANSWER_LABELS[a.rawAnswer]})</span>
                          )}
                        </td>
                        <td>
                          {a.evidenceIds.join(', ') || '—'}
                          {a.invalidEvidenceIds.length > 0 && (
                            <span className="status error"> geçersiz: {a.invalidEvidenceIds.join(', ')}</span>
                          )}
                        </td>
                        <td>{a.rationale}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </details>
    </>
  )
}
