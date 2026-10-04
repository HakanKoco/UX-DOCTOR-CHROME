// Teslim kontrolü (npm run teslim-kontrol). Yeni bağımlılık yok: mevcut Vitest ayrı bir yapılandırmayla
// (vitest.teslim.config.ts) çalıştırılır; böylece rapor şeması TypeScript'teki tek kaynaktan (src/shared/report.ts)
// içe aktarılır. Her kontrol bir "it"tir: ✓ geçti, × kaldı.
//
// Bu betik HİÇBİR ölçüm değeri üretmez ve hiçbir dosyayı değiştirmez; yalnızca var olanı okur ve denetler.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateReport } from '@/shared/report'
import manifestConfig from '../manifest.config'

const ROOT = path.resolve(import.meta.dirname, '..')
const REPORTS = path.join(ROOT, 'reports')
const TODO_MARKER = 'TODO: gerçek ölçüm'
const COMMIT_PREFIX = /^(feat|fix|chore|docs|test|refactor)(\([^)]+\))?!?: \S/
/** Sahte (test) değerleri bu işaretle yazılır; gerçek anahtarda bulunmaz. */
const FAKE_MARKER = 'TEST-ONLY'
const KEY_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'Claude (sk-ant-)', re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'Google (AIza)', re: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: 'Google auth key (AQ.)', re: /AQ\.[0-9A-Za-z_-]{20,}/g },
]
const SITE_CATEGORIES = [
  { prefix: 'saglik-', label: 'sağlık' },
  { prefix: 'eticaret-', label: 'Türk e-ticaret' },
  { prefix: 'kamu-', label: 'kamu hizmeti' },
]

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

function lines(text: string): string[] {
  return text.split('\n').filter((l) => l.trim() !== '')
}

function reportFiles(): string[] {
  if (!existsSync(REPORTS)) return []
  return readdirSync(REPORTS).filter((f) => f.endsWith('.json'))
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(path.join(REPORTS, file), 'utf8'))
}

function isMainReport(file: string): boolean {
  return !file.startsWith('tutarlilik-') && !file.startsWith('halusinasyon-')
}

/** Satırlarda, kod bloğu ve `ters tırnak` içi hariç TODO yer tutucusu sayısı (talimat metinleri sayılmaz). */
function countPlaceholders(markdown: string): number {
  let inFence = false
  let count = 0
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    count += line.replace(/`[^`]*`/g, '').split(TODO_MARKER).length - 1
  }
  return count
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return markdownFiles(full)
    return name.endsWith('.md') ? [full] : []
  })
}

interface KeyHit {
  where: string
  pattern: string
  fake: boolean
}

function scanText(text: string, where: (lineNo: number) => string): KeyHit[] {
  const hits: KeyHit[] = []
  text.split('\n').forEach((line, i) => {
    for (const { name, re } of KEY_PATTERNS) {
      for (const m of line.matchAll(re)) hits.push({ where: where(i + 1), pattern: name, fake: m[0].includes(FAKE_MARKER) })
    }
  })
  return hits
}

/** Manifest izinleri, README "İzinler ve gerekçeleri" tablosundaki adlandırmayla. */
async function manifestPermissionEntries(): Promise<string[]> {
  const config = manifestConfig as unknown
  const m = (typeof config === 'function' ? await config({ mode: 'production', command: 'build' }) : config) as {
    permissions?: string[]
    host_permissions?: string[]
    optional_host_permissions?: string[]
  }
  return [
    ...(m.permissions ?? []),
    ...(m.host_permissions ?? []).map((h) => `host_permissions: ${h}`),
    ...(m.optional_host_permissions ?? []).map((h) => `optional_host_permissions: ${h}`),
  ].sort()
}

function readmePermissionEntries(): string[] {
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8')
  const start = readme.indexOf('## İzinler ve gerekçeleri')
  if (start < 0) return []
  const end = readme.indexOf('\n## ', start + 1)
  const section = readme.slice(start, end < 0 ? undefined : end)
  return lines(section)
    .filter((l) => l.startsWith('| `'))
    .flatMap((row) => {
      const cell = row.split('|')[1].replaceAll('`', '').trim()
      const m = /^(host_permissions|optional_host_permissions):\s*(.+)$/.exec(cell)
      if (!m) return [cell]
      return m[2].split(',').map((h) => `${m[1]}: ${h.trim()}`)
    })
    .sort()
}

describe('Teslim kontrolü — reports/', () => {
  it('reports/ altında JSON dosyası var', () => {
    expect(reportFiles(), 'reports/ altında hiç .json yok (Ödev §6: 3 sitenin JSON raporu)').not.toEqual([])
  })

  it('her site raporu rapor şemasına uyuyor (src/shared/report.ts validateReport)', () => {
    const problems = reportFiles()
      .filter(isMainReport)
      .flatMap((f) => {
        try {
          return validateReport(readJson(f)).map((e) => `${f}: ${e}`)
        } catch (e) {
          return [`${f}: JSON okunamadı (${(e as Error).message})`]
        }
      })
    expect(problems).toEqual([])
  })

  it('tutarlılık ve halüsinasyon dışa aktarımları doğru türde', () => {
    const problems = reportFiles()
      .filter((f) => !isMainReport(f))
      .flatMap((f) => {
        const want = f.startsWith('tutarlilik-') ? 'consistency' : 'hallucination-review'
        try {
          const kind = (readJson(f) as { kind?: unknown }).kind
          return kind === want ? [] : [`${f}: kind "${String(kind)}", beklenen "${want}"`]
        } catch (e) {
          return [`${f}: JSON okunamadı (${(e as Error).message})`]
        }
      })
    expect(problems).toEqual([])
  })

  it.each(SITE_CATEGORIES)('$label sitesinin raporu var ($prefix*.json)', ({ prefix }) => {
    const found = reportFiles().filter((f) => f.startsWith(prefix))
    expect(found, `reports/${prefix}<site>.json bulunamadı`).not.toEqual([])
  })
})

describe('Teslim kontrolü — ölçüm yer tutucuları', () => {
  it(`README.md ve docs/ içinde "${TODO_MARKER}" kalmadı`, () => {
    const files = [path.join(ROOT, 'README.md'), ...markdownFiles(path.join(ROOT, 'docs'))]
    const remaining = files
      .map((f) => ({ file: path.relative(ROOT, f).replaceAll('\\', '/'), n: countPlaceholders(readFileSync(f, 'utf8')) }))
      .filter((r) => r.n > 0)
      .map((r) => `${r.file}: ${r.n}`)
    expect(remaining, 'Doldurulmamış ölçüm alanları (değerler yalnızca gerçek çalıştırmalardan gelir)').toEqual([])
  })
})

describe('Teslim kontrolü — API anahtarı', () => {
  const tracked = lines(git(['ls-files']))
  const untracked = lines(git(['ls-files', '--others', '--exclude-standard']))
  const workingTreeHits = [...tracked, ...untracked]
    .filter((f) => existsSync(path.join(ROOT, f)) && !/\.(png|jpe?g|gif|ico|webp|zip)$/i.test(f))
    .flatMap((f) => scanText(readFileSync(path.join(ROOT, f), 'utf8'), (n) => `${f}:${n}`))

  it('çalışma ağacında gerçek anahtar deseni yok (sk-ant-, AIza, AQ.)', () => {
    expect(workingTreeHits.filter((h) => !h.fake).map((h) => `${h.where} (${h.pattern})`)).toEqual([])
  })

  it('commit geçmişinde (tüm dallar, eklenen satırlar) gerçek anahtar deseni yok', () => {
    let commit = ''
    const hits: KeyHit[] = []
    for (const line of git(['log', '--all', '-p', '--no-color', '--format=commit %h']).split('\n')) {
      if (line.startsWith('commit ')) commit = line.slice(7)
      else if (line.startsWith('+') && !line.startsWith('+++')) hits.push(...scanText(line, () => `commit ${commit}`))
    }
    expect(hits.filter((h) => !h.fake).map((h) => `${h.where} (${h.pattern})`)).toEqual([])
  })

  it(`test kodundaki sahte değerler ("${FAKE_MARKER}" işaretli) yalnızca bilgi için listelenir`, () => {
    const fakes = workingTreeHits.filter((h) => h.fake)
    console.log(
      fakes.length === 0
        ? 'Sahte anahtar değeri yok.'
        : `Sahte (gerçek olmayan) anahtar biçimli değerler:\n${fakes.map((h) => `  - ${h.where} (${h.pattern})`).join('\n')}`,
    )
    expect(fakes.every((h) => /\.test\.ts:|^tests\//.test(h.where)), 'Sahte değer yalnızca test dosyalarında olmalı').toBe(true)
  })
})

describe('Teslim kontrolü — commit geçmişi', () => {
  const subjects = lines(git(['log', '--format=%h %s']))

  it('birden çok commit var (Ödev §6: tek commit kabul edilmez)', () => {
    console.log(`Commit sayısı: ${subjects.length}`)
    expect(subjects.length).toBeGreaterThan(1)
  })

  it('tüm commit mesajları Conventional Commits önekli (feat/fix/chore/docs/test/refactor)', () => {
    expect(subjects.filter((s) => !COMMIT_PREFIX.test(s.slice(s.indexOf(' ') + 1)))).toEqual([])
  })
})

describe('Teslim kontrolü — izinler', () => {
  it('manifest izinleri README "İzinler ve gerekçeleri" tablosuyla birebir aynı', async () => {
    const manifest = await manifestPermissionEntries()
    const readme = readmePermissionEntries()
    // İki liste de boşsa karşılaştırma anlamsız olur (ör. README başlığı değiştiyse).
    expect(manifest.length).toBeGreaterThan(0)
    expect(readme.length, 'README "İzinler ve gerekçeleri" tablosu okunamadı').toBeGreaterThan(0)
    expect({
      readmedeEksik: manifest.filter((p) => !readme.includes(p)),
      manifesteFazla: readme.filter((p) => !manifest.includes(p)),
    }).toEqual({ readmedeEksik: [], manifesteFazla: [] })
  })
})
