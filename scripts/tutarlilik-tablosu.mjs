#!/usr/bin/env node
// Tutarlılık dışa aktarımından (yan panel → "Tutarlılık sonuçlarını JSON olarak indir") README'ye yapıştırılacak
// Markdown tablosu üretir. Yalnızca dosyadaki gerçek ölçümleri yazar.
// Kullanım: node scripts/tutarlilik-tablosu.mjs reports/tutarlilik-<site>.json
import fs from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Kullanım: node scripts/tutarlilik-tablosu.mjs <tutarlilik.json>')
  process.exit(1)
}
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
if (data.kind !== 'consistency') {
  console.error(`${file}: tutarlılık dosyası değil (kind=${data.kind}).`)
  process.exit(1)
}

const f = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(1))
const runs = data.runs
const header = ['İlke', ...runs.map((r) => `#${r.runIndex}`), 'Ort.', 'Std', 'Min', 'Max', 'Aralık']
const lines = [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`]
for (const [id, s] of Object.entries(data.stats.principles)) {
  lines.push(`| ${s.label} | ${runs.map((r) => f(r.principleScores[id])).join(' | ')} | ${f(s.mean)} | ${f(s.std)} | ${f(s.min)} | ${f(s.max)} | ${f(s.range)} |`)
}
const t = data.stats.llmTotal
lines.push(`| **LLM toplam** | ${runs.map((r) => f(r.llmScore)).join(' | ')} | ${f(t.mean)} | ${f(t.std)} | ${f(t.min)} | ${f(t.max)} | ${f(t.range)} |`)

console.log(`Sayfa: ${data.page.url}`)
console.log(`Sağlayıcı: ${data.provider ?? 'claude'} · Model: ${data.requestedModel} (yanıtlayan: ${[...new Set(runs.map((r) => r.servedModel))].join(', ')}) · Prompt: ${data.promptVersion}`)
console.log(`Çalıştırma: ${data.completedRuns}/${data.requestedRuns} · ${runs[0]?.timestamp ?? '—'} → ${runs.at(-1)?.timestamp ?? '—'}\n`)
console.log(lines.join('\n'))
console.log(`\nEn büyük aralık: ${f(data.stats.maxRange)} puan · Eşik (${data.stats.threshold}) aşıldı mı: ${data.stats.exceedsThreshold ? 'EVET' : 'hayır'}`)
const unstable = data.questionAgreement.filter((q) => q.agreement < 1)
if (unstable.length > 0) {
  console.log('\nÇalıştırmalar arasında cevabı değişen sorular:')
  for (const q of unstable) console.log(`- ${q.questionId}: ${q.answers.join(' / ')} (uyum ${(q.agreement * 100).toFixed(0)}%)`)
}
