import { diagnosticsRows, type GeminiDiagnostics } from './geminiResponse'

/** Gemini HTTP hatası için güvenli teşhis kutusu (ayarlar sayfası ve yan panelde ortak). Anahtar gösterilmez. */
export default function DiagnosticsDetails({ diagnostics }: { diagnostics: GeminiDiagnostics }) {
  return (
    <details>
      <summary>Teşhis bilgisi (anahtar içermez)</summary>
      <table className="diag-table">
        <tbody>
          {diagnosticsRows(diagnostics).map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>
                <code>{value}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
