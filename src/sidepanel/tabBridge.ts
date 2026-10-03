// Yan panel ↔ etkin sekme köprüsü. Analiz betiği yalnızca burada, kullanıcı eylemiyle enjekte edilir.
// CRXJS `?iife` importu: betiği tek parça (IIFE) olarak derler ve dosya yolunu döndürür.
import analyzerPath from '@/content/analyzer.ts?iife'
import { CONTENT_API_VERSION, type ContentApi, type ContentMethod } from '@/shared/contentApi'


export class TabAccessError extends Error {
  /** true: kullanıcı isteğe bağlı site iznini verirse sorun çözülebilir. */
  readonly canRequestPermission: boolean
  constructor(message: string, canRequestPermission: boolean) {
    super(message)
    this.canRequestPermission = canRequestPermission
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab & { id: number }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || tab.id === undefined) throw new TabAccessError('Etkin sekme bulunamadı.', false)
  return tab as chrome.tabs.Tab & { id: number }
}

function translateAccessError(error: unknown): TabAccessError {
  const message = error instanceof Error ? error.message : String(error)
  if (/chrome:\/\/|chrome-extension:\/\/|extensions gallery|webstore|edge:\/\//i.test(message)) {
    return new TabAccessError('Tarayıcının kendi sayfaları ve eklenti mağazası analiz edilemez. Bir web sayfası açın.', false)
  }
  if (/file:\/\//i.test(message)) {
    return new TabAccessError('Yerel dosyalar (file://) analiz edilmez.', false)
  }
  if (/Cannot access|permission|host/i.test(message)) {
    return new TabAccessError(
      'Bu sekmeye erişim izni yok. Araç çubuğundaki UX Doktor simgesine bu sekmedeyken tıklayın ya da aşağıdan site erişim izni verin.',
      true,
    )
  }
  return new TabAccessError(`Sayfaya erişilemedi: ${message}`, false)
}

type Wrapped<T> = { ok: true; value: T } | { ok: false; missing: boolean; error: string }

async function invoke<M extends ContentMethod>(
  tabId: number,
  method: M,
  args: Parameters<ContentApi[M]>,
): Promise<Wrapped<Awaited<ReturnType<ContentApi[M]>>>> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    // Bu fonksiyon sayfanın izole dünyasında çalışır; dış kapsamdaki değişkenlere erişemez.
    func: async (name: string, params: unknown[], expectedVersion: number) => {
      const api = globalThis.__uxDoctor as unknown as Record<string, (...a: unknown[]) => unknown> | undefined
      if (!api || (api as unknown as { version: number }).version !== expectedVersion) {
        return { ok: false, missing: true, error: 'API yok ya da eski sürüm' }
      }
      try {
        return { ok: true, value: await api[name](...params) }
      } catch (e) {
        return { ok: false, missing: false, error: e instanceof Error ? e.message : String(e) }
      }
    },
    args: [method, args as unknown[], CONTENT_API_VERSION],
  })
  return injection?.result as Wrapped<Awaited<ReturnType<ContentApi[M]>>>
}

/** Analiz betiğini (gerekirse) enjekte eder ve API metodunu çağırır. */
export async function callContent<M extends ContentMethod>(
  tabId: number,
  method: M,
  ...args: Parameters<ContentApi[M]>
): Promise<Awaited<ReturnType<ContentApi[M]>>> {
  try {
    let result = await invoke(tabId, method, args)
    if (!result.ok && result.missing) {
      await chrome.scripting.executeScript({ target: { tabId }, files: [analyzerPath] })
      result = await invoke(tabId, method, args)
    }
    if (!result) throw new Error('Sayfadan yanıt alınamadı.')
    if (!result.ok) throw new Error(result.error)
    return result.value
  } catch (error) {
    if (error instanceof TabAccessError) throw error
    if (error instanceof Error && /Cannot access|chrome:\/\/|permission|host|gallery|file:\/\//i.test(error.message)) {
      throw translateAccessError(error)
    }
    throw error
  }
}
