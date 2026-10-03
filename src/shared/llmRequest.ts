// Claude API istek gövdesinin tek kaynağı. Onay ekranında gösterilen gövde ile gönderilen gövde AYNI
// nesnedir (buildRequestBody). Yalnızca maskelenmiş envanter gider; ekran görüntüsü gönderilmez.
import { PAGE_EVIDENCE_ID, toLlmInventory, type Inventory } from './inventory'
import { FIXED_EFFORT, getModelOption, type ModelId } from './models'
import { PROMPT_VERSION, PRINCIPLE_LABELS, RUBRIC } from './rubric'

export const MAX_TOKENS = 16000

/** Sunucu taraflı ret yedeği (fallbacks: "default") için beta başlığı. */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export const SYSTEM_PROMPT = `Sen bir kullanılabilirlik (UX) denetçisisin. Görevin, bir web sayfasının numaralı öğe envanterini Don Norman'ın tasarım ilkelerine göre verilen evet/hayır rubriğiyle değerlendirmek.

KURALLAR
1. Yalnızca kullanıcı mesajındaki envantere dayan. Envanterde olmayan bir öğe, metin ya da özellik uydurma.
2. Her rubrik sorusunu TAM OLARAK BİR KEZ cevapla: "evet" (ilkeye uygun), "hayir" (sorun var) ya da "belirsiz" (envanter karar vermeye yetmiyor ya da soru bu sayfaya uygulanamıyor).
3. "hayir" cevabında evidenceIds alanına sorunu gösteren öğelerin kimliklerini (E1, E2, …) envanterde yazıldığı gibi yaz. Sorun belirli bir öğeye bağlanamıyorsa (ör. sayfada hiç canlı bölge yok) yalnızca "${PAGE_EVIDENCE_ID}" kimliğini kullan ve gerekçede sayfa özetindeki ilgili alanı belirt. Kanıt gösteremiyorsan "belirsiz" de.
4. "evet" cevabında evidenceIds isteğe bağlıdır; destekleyen öğeleri yazabilirsin.
5. Puan verme. Skoru yazılım hesaplar.
6. rationale: en çok iki cümle, Türkçe, envanterdeki somut alanlara (ör. nameSource, fontSizePx, states) atıf yaparak.
7. fix: "hayir" cevabında somut ve uygulanabilir bir düzeltme (Türkçe, bir-iki cümle). Diğer cevaplarda boş metin ("").
8. Analiz statiktir: sayfayla etkileşim yapılmadı (tıklama, yazma, odaklama yok). Hover/odak/yükleme davranışını yalnızca envanterdeki ipuçlarından (states, page.styleRules, page.counts) değerlendir; ipucu yoksa "belirsiz" de.
9. Metinlerdeki [TC], [TELEFON], [E-POSTA], [IBAN], [KART] gizlilik maskeleridir; bunları sorun sayma.
10. nameSource "value-attribute-hidden" olan düğmelerin adı vardır ama gizlilik nedeniyle gönderilmemiştir; bunu "adsız öğe" sayma.
11. Envanter kesildiyse (meta.truncated=true) yalnızca görülen öğeler hakkında karar ver; görmediğin öğeler hakkında hüküm kurma.`

export interface LlmUserPayload {
  promptVersion: string
  instructions: string
  rubric: { id: string; principle: string; question: string; hint: string }[]
  inventory: Inventory
}

export function buildUserPayload(inventory: Inventory): LlmUserPayload {
  return {
    promptVersion: PROMPT_VERSION,
    instructions:
      'Aşağıdaki rubrikteki her soruyu, verilen envantere göre cevapla. Cevapları şemaya uygun JSON olarak döndür.',
    rubric: RUBRIC.map((q) => ({
      id: q.id,
      principle: PRINCIPLE_LABELS[q.principle],
      question: q.question,
      hint: q.hint,
    })),
    inventory: toLlmInventory(inventory),
  }
}

/** Yapılandırılmış çıktı şeması (output_config.format). Desteklenmeyen kısıtlar (minItems, pattern) kullanılmaz. */
export const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answers'],
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['questionId', 'answer', 'evidenceIds', 'rationale', 'fix'],
        properties: {
          questionId: { type: 'string', enum: RUBRIC.map((q) => q.id) },
          answer: { type: 'string', enum: ['evet', 'hayir', 'belirsiz'] },
          evidenceIds: { type: 'array', items: { type: 'string' } },
          rationale: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
} as const

export interface LlmRequestBody {
  model: ModelId
  max_tokens: number
  system: string
  messages: { role: 'user'; content: string }[]
  output_config: { format: { type: 'json_schema'; schema: typeof RESPONSE_SCHEMA }; effort?: typeof FIXED_EFFORT }
  temperature?: number
  cache_control: { type: 'ephemeral' }
  fallbacks?: 'default'
}

/**
 * İstek gövdesini kurar. Modele göre:
 * - Opus 5.5 / Sonnet 5.5: effort sabit "medium"; temperature GÖNDERİLMEZ (bu modeller reddeder).
 *   Ret durumunda sunucu taraflı yedek model ("fallbacks": "default"); hangi modelin yanıtladığı kaydedilir.
 * - Haiku 4.5: temperature 0; effort gönderilmez (desteklenmez).
 * cache_control: aynı sayfanın tekrar analizlerinde (tutarlılık testi) girdi önbellekten okunur; çıktıyı etkilemez.
 */
export function buildRequestBody(model: ModelId, inventory: Inventory): LlmRequestBody {
  const option = getModelOption(model)
  if (!option) throw new Error(`Bilinmeyen model: ${model}`)
  const body: LlmRequestBody = {
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(buildUserPayload(inventory)) }],
    output_config: {
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      ...(option.supportsEffort ? { effort: FIXED_EFFORT } : {}),
    },
    cache_control: { type: 'ephemeral' },
  }
  if (option.supportsTemperature) body.temperature = 0
  if (option.supportsServerFallback) body.fallbacks = 'default'
  return body
}

/** Gövdenin gerektirdiği beta başlıkları (onay ekranında da gösterilir). */
export function requiredBetas(body: LlmRequestBody): string[] {
  return body.fallbacks ? [FALLBACK_BETA] : []
}
