import { describe, expect, it } from 'vitest'
import { NETWORK_QUIET_MS, RESOURCE_BUFFER_DEFAULT, evaluateLoadState, loadStateWarning } from './loadState'

describe('evaluateLoadState', () => {
  it('readyState "complete" değilse "loading" (analiz yapılmaz)', () => {
    for (const readyState of ['loading', 'interactive']) {
      const s = evaluateLoadState({ readyState, msSinceLastResource: 10_000, resourceCount: 3 })
      expect(s.status).toBe('loading')
      expect(loadStateWarning(s)).toContain('Sayfa hâlâ yükleniyor')
    }
  })

  it(`yüklendi ama son ${NETWORK_QUIET_MS} ms içinde kaynak bitti: "network-busy" (uyarı, analiz sürer)`, () => {
    const s = evaluateLoadState({ readyState: 'complete', msSinceLastResource: 500, resourceCount: 10 })
    expect(s.status).toBe('network-busy')
    expect(loadStateWarning(s)).toContain('ağ isteği')
  })

  it('yüklendi ve ağ sessiz ya da hiç kaynak yok: "complete", uyarı yok', () => {
    expect(evaluateLoadState({ readyState: 'complete', msSinceLastResource: 5000, resourceCount: 10 }).status).toBe('complete')
    const none = evaluateLoadState({ readyState: 'complete', msSinceLastResource: null, resourceCount: 0 })
    expect(none.status).toBe('complete')
    expect(loadStateWarning(none)).toBeNull()
  })

  it('Resource Timing tamponu doluysa ağ sessizliği ölçülemez: "network-unknown"', () => {
    const s = evaluateLoadState({ readyState: 'complete', msSinceLastResource: 9000, resourceCount: RESOURCE_BUFFER_DEFAULT })
    expect(s).toMatchObject({ status: 'network-unknown', resourceBufferFull: true })
    expect(loadStateWarning(s)).toContain('ölçülemedi')
  })
})
