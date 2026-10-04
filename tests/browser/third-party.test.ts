import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { scoreDeterministic } from '@/scoring/score'
import type { DeterministicRaw } from '@/shared/contentApi'
import { Browser, fixtureUrl } from './chrome'

// Üçüncü taraf çerez/onay bileşeni etiketi: yalnızca etiket, skor hesabı değişmez (öğrenci kararı).

let browser: Browser
let det: DeterministicRaw

beforeAll(async () => {
  browser = await Browser.launch()
  await browser.page.open(fixtureUrl('ucuncu-taraf.html'))
  det = await browser.page.evaluate<DeterministicRaw>('globalThis.__uxDoctor.runDeterministic()')
})

afterAll(async () => {
  await browser?.close()
})

describe('üçüncü taraf bileşen etiketi', () => {
  const contrast = (selector: string) => det.findings.find((f) => f.ruleId === 'color-contrast' && f.selector === selector)

  it('çerez bantlarındaki bulgular sağlayıcı adıyla etiketlenir', () => {
    expect(contrast('#cs-soluk')?.thirdParty).toEqual({ vendor: 'CookieSeal', kind: 'cookie-consent' })
    expect(contrast('#ot-soluk')?.thirdParty).toEqual({ vendor: 'OneTrust', kind: 'cookie-consent' })
  })

  it('sayfanın kendi içeriğindeki aynı hata etiketlenmez', () => {
    expect(contrast('#kendi-soluk')).toBeDefined()
    expect(contrast('#kendi-soluk')?.thirdParty).toBeUndefined()
  })

  it('etiket skoru değiştirmez: bulgular düşülmez, skor etiketsiz hesapla aynı', () => {
    const untagged = det.findings.map(({ thirdParty: _t, ...f }) => f)
    expect(det.findings.filter((f) => f.thirdParty).length).toBeGreaterThanOrEqual(2)
    expect(scoreDeterministic(det.findings, det.passesByCategory)).toEqual(scoreDeterministic(untagged, det.passesByCategory))
  })
})
