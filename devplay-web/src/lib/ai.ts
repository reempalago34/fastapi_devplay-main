/**
 * DevPlay AI Client 🧠
 * Un solo lugar para hablar con el cerebro de Pixel (GLM de Z.ai).
 *
 * Dos modos, en orden de prioridad:
 *
 * 1) CLAVE PROPIA (recomendado para producción):
 *    Pon en .env:
 *      ZAI_API_KEY=tu_clave_de_z.ai
 *      ZAI_MODEL=glm-4.5-flash        (opcional; es el modelo GRATIS)
 *      ZAI_BASE_URL=https://api.z.ai/api/paas/v4   (opcional)
 *    → Se usa la API pública de Z.ai (compatible con OpenAI) vía fetch directo.
 *    Consigue tu clave gratis en: https://z.ai/manage-apikey/apikey-list
 *
 * 2) SDK del entorno (desarrollo):
 *    Si no hay ZAI_API_KEY, se usa z-ai-web-dev-sdk, que lee sus credenciales
 *    del archivo .z-ai-config (en este entorno ya viene conectado).
 *
 * Uso:
 *   import { chatComplete } from '@/lib/ai'
 *   const text = await chatComplete([{ role: 'system', content: '...' }, ...])
 */

export interface AiMessage {
  role: 'system' | 'assistant' | 'user'
  content: string
}

const ENV_KEY = process.env.ZAI_API_KEY || ''
const ENV_MODEL = process.env.ZAI_MODEL || 'glm-4.5-flash'
const ENV_BASE_URL = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4'

export function aiMode(): 'own-key' | 'sdk' {
  return ENV_KEY ? 'own-key' : 'sdk'
}

/* ---------- Modo 1: clave propia (API pública de Z.ai) ---------- */

async function ownKeyComplete(
  messages: AiMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal }
): Promise<string> {
  const res = await fetch(`${ENV_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ENV_KEY}`,
    },
    body: JSON.stringify({
      model: ENV_MODEL,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      thinking: { type: 'disabled' },
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Z.ai API ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content?.trim() || ''
}

/* ---------- Modo 2: SDK del entorno ---------- */

async function sdkComplete(messages: AiMessage[]): Promise<string> {
  const { default: ZAI } = await import('z-ai-web-dev-sdk')
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content?.trim() || ''
}

/* ---------- API pública del módulo ---------- */

/**
 * Interruptor térmico 🔌: si la clave propia falla varias seguidas
 * (p. ej. servidor sin salida a internet o clave inválida), se desactiva
 * un rato para no frenar cada respuesta, y Pixel sigue con el SDK del entorno.
 */
let ownKeyFailures = 0
let ownKeyDisabledUntil = 0
const OWN_KEY_MAX_FAILURES = 2
const OWN_KEY_COOLDOWN_MS = 10 * 60 * 1000

/**
 * Pide una respuesta al cerebro y devuelve el texto.
 * Prioridad: clave propia (ZAI_API_KEY) → SDK del entorno.
 * Lanza Error si ambos fallan — el llamador decide cómo responder.
 */
export async function chatComplete(
  messages: AiMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {}
): Promise<string> {
  const { timeoutMs = 30_000 } = opts

  if (ENV_KEY && Date.now() > ownKeyDisabledUntil) {
    try {
      const text = await ownKeyComplete(messages, {
        ...opts,
        // La clave propia usa un presupuesto más corto para no frenar el fallback
        signal: AbortSignal.timeout(Math.min(timeoutMs, 15_000)),
      })
      ownKeyFailures = 0
      return text
    } catch (err) {
      ownKeyFailures++
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[ai] clave propia falló (${ownKeyFailures}): ${msg.slice(0, 180)}`)
      if (ownKeyFailures >= OWN_KEY_MAX_FAILURES) {
        ownKeyDisabledUntil = Date.now() + OWN_KEY_COOLDOWN_MS
        ownKeyFailures = 0
        console.warn('[ai] desactivo la clave propia 10 min y sigo con la conexión del entorno')
      }
      // cae al SDK ↓
    }
  }

  return sdkComplete(messages)
}
