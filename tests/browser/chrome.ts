// Tarayıcı testleri için en küçük CDP (Chrome DevTools Protocol) istemcisi. Yeni bağımlılık yok:
// yüklü Chrome başsız (headless) açılır, Node'un yerleşik WebSocket'i ile konuşulur.
// YALNIZCA test aracıdır: yerel fixture dosyalarını yükler. Eklentinin kendisi chrome.debugger / CDP kullanmaz.
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
export const ANALYZER_BUNDLE = path.join(ROOT, 'dist', 'src', 'content', 'analyzer.js')
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures')

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

export function findChrome(): string {
  const found = CHROME_CANDIDATES.find((p): p is string => !!p && existsSync(p))
  if (!found) throw new Error('Chrome bulunamadı. CHROME_PATH ortam değişkeniyle Chrome yolunu verin.')
  return found
}

export function fixtureUrl(name: string): string {
  return pathToFileURL(path.join(FIXTURES, name)).href
}

interface CdpMessage {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { message: string }
}

export class Page {
  private nextId = 1
  private readonly pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>()
  private readonly listeners = new Map<string, ((params: Record<string, unknown>) => void)[]>()

  constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data)) as CdpMessage
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id)
        if (!p) return
        this.pending.delete(msg.id)
        if (msg.error) p.reject(new Error(msg.error.message))
        else p.resolve(msg.result ?? {})
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params ?? {})
      }
    })
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  once(method: string): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      const list = this.listeners.get(method) ?? []
      const fn = (params: Record<string, unknown>) => {
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((f) => f !== fn))
        resolve(params)
      }
      list.push(fn)
      this.listeners.set(method, list)
    })
  }

  /** Fixture'ı açar ve (varsayılan olarak) derlenmiş analiz betiğini (dist IIFE) sayfaya enjekte eder. */
  async open(url: string, injectAnalyzer = true): Promise<void> {
    const loaded = this.once('Page.loadEventFired')
    await this.send('Page.navigate', { url })
    await loaded
    if (injectAnalyzer) await this.evaluate(readFileSync(ANALYZER_BUNDLE, 'utf8'), false)
  }

  /** Sonraki her belge yüklenmeden önce çalışacak betik (ör. test için sahte chrome nesnesi). */
  async addInitScript(source: string): Promise<void> {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source })
  }

  /** Sayfada koşul doğru olana kadar bekler (en çok timeoutMs). */
  async waitFor(expression: string, timeoutMs = 10_000): Promise<void> {
    const until = Date.now() + timeoutMs
    while (Date.now() < until) {
      if (await this.evaluate<boolean>(`Boolean(${expression})`)) return
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error(`Koşul ${timeoutMs} ms içinde sağlanmadı: ${expression}`)
  }

  /** Gerçek klavye olayı olarak Tab tuşu (yalnızca test aracında; eklenti klavye simülasyonu yapmaz). */
  async pressTab(): Promise<void> {
    const key = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key })
  }

  /** Sayfada bir ifade çalıştırır; Promise ise bekler; sonucu JSON değer olarak döndürür. */
  async evaluate<T>(expression: string, awaitPromise = true): Promise<T> {
    const r = (await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })) as {
      result?: { value?: T }
      exceptionDetails?: { text: string; exception?: { description?: string } }
    }
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result?.value as T
  }
}

export class Browser {
  private constructor(
    private readonly proc: ChildProcess,
    private readonly profileDir: string,
    readonly page: Page,
  ) {}

  static async launch(): Promise<Browser> {
    if (!existsSync(ANALYZER_BUNDLE)) throw new Error(`${ANALYZER_BUNDLE} yok. Önce "npm run build" çalıştırın.`)
    const profileDir = mkdtempSync(path.join(tmpdir(), 'ux-doktor-test-'))
    const proc = spawn(
      findChrome(),
      [
        '--headless=new',
        '--remote-debugging-port=0',
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-gpu',
        '--window-size=1280,900',
        '--allow-file-access-from-files',
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    const port = await new Promise<number>((resolve, reject) => {
      let buf = ''
      const timer = setTimeout(() => reject(new Error('Chrome DevTools bağlantı adresi 20 sn içinde gelmedi.')), 20_000)
      proc.stderr?.on('data', (chunk: Buffer) => {
        buf += chunk.toString()
        const m = /DevTools listening on ws:\/\/[^:]+:(\d+)\//.exec(buf)
        if (m) {
          clearTimeout(timer)
          resolve(Number(m[1]))
        }
      })
      proc.on('exit', (code) => reject(new Error(`Chrome kapandı (kod ${code}).`)))
    })
    const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as {
      type: string
      webSocketDebuggerUrl: string
    }[]
    const target = targets.find((t) => t.type === 'page')
    if (!target) throw new Error('Chrome sayfa hedefi bulunamadı.')
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve())
      ws.addEventListener('error', () => reject(new Error('CDP WebSocket açılamadı.')))
    })
    const page = new Page(ws)
    await page.send('Page.enable')
    await page.send('Runtime.enable')
    return new Browser(proc, profileDir, page)
  }

  async close(): Promise<void> {
    this.proc.kill()
    await new Promise((r) => setTimeout(r, 300))
    try {
      rmSync(this.profileDir, { recursive: true, force: true })
    } catch {
      // Windows'ta Chrome dosyaları geç bırakabilir; geçici klasör sonra temizlenir.
    }
  }
}
