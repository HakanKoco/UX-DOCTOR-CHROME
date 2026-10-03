// Rapora girecek HTML kanıt parçalarını kısaltır ve kişisel verileri maskeler.
import { maskText } from './masking'

const MAX_HTML_LENGTH = 400

export function sanitizeEvidenceHtml(html: string): string {
  const compact = maskText(html.replace(/\s+/g, ' ').trim())
  return compact.length > MAX_HTML_LENGTH ? `${compact.slice(0, MAX_HTML_LENGTH)}…` : compact
}
