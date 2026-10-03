import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { detectSensitivePage, isLocked, type SensitivitySignals } from '@/shared/sensitivity'
import { Browser, fixtureUrl } from './chrome'

// 5. madde: gerçek collectSensitivitySignals (derlenmiş analiz betiği) iki anonim fixture üzerinde.

let browser: Browser

beforeAll(async () => {
  browser = await Browser.launch()
})

afterAll(async () => {
  await browser?.close()
})

async function signalsOf(fixture: string): Promise<SensitivitySignals> {
  await browser.page.open(fixtureUrl(fixture))
  return browser.page.evaluate<SensitivitySignals>('globalThis.__uxDoctor.collectSensitivitySignals()')
}

describe('gizlilik tespiti (tarayıcıda, gerçek sinyal toplama)', () => {
  it('(a) belge sayfası: gizli "Oturumu kapat" görünür metin sayılmaz → hassas değil ya da belirsiz', async () => {
    const s = await signalsOf('gizlilik-belge-sayfasi.html')
    expect(s.uiTexts).toContain('Oturum aç')
    expect(s.uiTexts).not.toContain('Oturumu kapat')
    expect(s.hiddenUiTexts).toContain('Oturumu kapat')
    const r = detectSensitivePage(s)
    expect(['safe', 'uncertain']).toContain(r.level)
    expect(r.strongReasons).toEqual([])
  })

  it('(b) sohbet uygulaması kabuğu: yazma alanı ve gizli hesap menüsü → hassas ya da belirsiz, gönderim kilitli', async () => {
    const s = await signalsOf('gizlilik-sohbet-uygulamasi.html')
    expect(s.passwordFieldCount).toBe(0)
    expect(s.composerCount).toBe(1)
    const r = detectSensitivePage(s)
    expect(['sensitive', 'uncertain']).toContain(r.level)
    expect(isLocked(r.level)).toBe(true)
    // Gerçek adreste alan adı listesi güçlü sinyal ekler:
    expect(detectSensitivePage({ ...s, url: 'https://claude.ai/chat/00000000-0000-0000-0000-000000000000' }).level).toBe('sensitive')
  })

  it('yazma alanının içeriği okunmaz: sinyallerde yalnızca sayı var', async () => {
    const s = await signalsOf('gizlilik-sohbet-uygulamasi.html')
    expect(JSON.stringify(s)).not.toContain('Lorem ipsum soru metni')
  })
})
