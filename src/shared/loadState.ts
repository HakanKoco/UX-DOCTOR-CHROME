// Sayfa yüklenme durumu: analiz, sayfa hâlâ yüklenirken yapılırsa sonuç eksik DOM'a göre çıkar. Saf fonksiyon (birim
// testli); ölçüm içerik betiğinde (src/content/analyzer.ts) yapılır. Sayfayla etkileşim yoktur, yeni izin gerekmez.
//
// Kaynaklar:
// - document.readyState: "loading" | "interactive" | "complete" (HTML Living Standard).
// - performance.getEntriesByType('resource'): yalnızca BİTMİŞ kaynak istekleri listelenir; süren istekler görünmez.
//   Tampon varsayılan olarak 250 kayıtla sınırlıdır (Resource Timing, "resource timing buffer size"); dolarsa yeni
//   kayıt eklenmez ve ağ sessizliği ölçülemez. Tamponu büyütmek sayfanın durumunu değiştireceği için yapılmaz.

export type LoadStatus = 'complete' | 'loading' | 'network-busy' | 'network-unknown'

export interface LoadState {
  readyState: string
  /** Son biten kaynak isteğinden bu yana geçen süre (ms); hiç kaynak yoksa null. */
  msSinceLastResource: number | null
  /** Resource Timing tamponu dolu mu (doluysa ağ sessizliği ölçülemez). */
  resourceBufferFull: boolean
  status: LoadStatus
}

/** Son kaynak isteği bundan daha yakın zamanda bittiyse ağ "meşgul" sayılır. */
export const NETWORK_QUIET_MS = 2000
export const RESOURCE_BUFFER_DEFAULT = 250

export function evaluateLoadState(input: {
  readyState: string
  msSinceLastResource: number | null
  resourceCount: number
}): LoadState {
  const resourceBufferFull = input.resourceCount >= RESOURCE_BUFFER_DEFAULT
  let status: LoadStatus
  if (input.readyState !== 'complete') status = 'loading'
  else if (resourceBufferFull) status = 'network-unknown'
  else if (input.msSinceLastResource !== null && input.msSinceLastResource < NETWORK_QUIET_MS) status = 'network-busy'
  else status = 'complete'
  return { readyState: input.readyState, msSinceLastResource: input.msSinceLastResource, resourceBufferFull, status }
}

/** Panelde gösterilecek Türkçe uyarı; sorun yoksa null. */
export function loadStateWarning(s: LoadState): string | null {
  switch (s.status) {
    case 'loading':
      return `Sayfa hâlâ yükleniyor (document.readyState: ${s.readyState}). Yükleme bitince tekrar analiz edin.`
    case 'network-busy':
      return `Sayfa yüklendi ama son ${(NETWORK_QUIET_MS / 1000).toFixed(0)} sn içinde ağ isteği bitti; içerik hâlâ değişiyor olabilir. Gerekirse birkaç saniye sonra yeniden analiz edin.`
    case 'network-unknown':
      return 'Sayfa yüklendi; çok sayıda kaynak isteği olduğu için ağ sessizliği ölçülemedi. İçerik hâlâ değişiyorsa yeniden analiz edin.'
    default:
      return null
  }
}
