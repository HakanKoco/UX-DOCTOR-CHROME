#!/usr/bin/env node
// Elle doldurulmuş halüsinasyon doğrulama listelerinden (yan panel → "Elle doğrulama listesini JSON olarak indir")
// oranı hesaplar. Yalnızca dosyadaki gerçek değerleri sayar; boş (null) gercekMi alanlarını listeler.
// Kullanım: node scripts/halusinasyon-orani.mjs reports/halusinasyon-*.json
import fs from 'node:fs'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('Kullanım: node scripts/halusinasyon-orani.mjs <dosya.json> [dosya2.json …]')
  process.exit(1)
}

let total = 0
let real = 0
let notReal = 0
let unfilled = 0
let autoRefs = 0
let autoInvalid = 0
let autoDropped = 0
const unfilledList = []

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (data.kind !== 'hallucination-review') {
    console.error(`${file}: halüsinasyon doğrulama dosyası değil (kind=${data.kind}).`)
    process.exit(1)
  }
  autoRefs += data.autoCheck.totalReferences
  autoInvalid += data.autoCheck.invalidReferences
  autoDropped += data.autoCheck.droppedFindings
  for (const item of data.items) {
    total++
    if (item.gercekMi === true) real++
    else if (item.gercekMi === false) notReal++
    else {
      unfilled++
      unfilledList.push(`${file} → ${item.findingId}`)
    }
  }
}

const pct = (a, b) => (b === 0 ? '—' : `%${((100 * a) / b).toFixed(1)}`)
console.log(`Dosya sayısı: ${files.length}`)
console.log('\nOtomatik kontrol (kimlik envanterde mi):')
console.log(`  Atıf: ${autoRefs}, envanterde olmayan: ${autoInvalid} (${pct(autoInvalid, autoRefs)}), düşürülen bulgu: ${autoDropped}`)
console.log('\nElle doğrulama (otomatik kontrolden geçen bulgular):')
console.log(`  Bulgu: ${total}, gerçek: ${real}, gerçek değil: ${notReal}, doldurulmamış: ${unfilled}`)
console.log(`  Var olmayan/yanlış öğeye işaret eden bulgu oranı: ${pct(notReal, real + notReal)} (doldurulan ${real + notReal} bulgu üzerinden)`)
if (unfilled > 0) {
  console.log('\nUYARI: gercekMi alanı boş olan bulgular var; oran eksik veriyle hesaplandı:')
  for (const line of unfilledList) console.log(`  - ${line}`)
}
