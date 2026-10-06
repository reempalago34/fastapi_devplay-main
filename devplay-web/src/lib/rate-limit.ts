/**
 * Rate limiting anti-bot 🛡️ (ventana deslizante en memoria)
 *
 * Diseñado para un despliegue de UNA instancia (Coolify: 1 contenedor web).
 * Si algún día hay varias réplicas, migrar a Upstash Redis o similar.
 *
 * Uso en una ruta:
 *   const rl = rateLimit(req, 'register', 5, 60_000)
 *   if (!rl.ok) return NextResponse.json({ error: 'Demasiadas peticiones...' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
 */

type Bucket = { hits: number[] }

const buckets = new Map<string, Bucket>()

// Limpieza periódica para no crecer infinito (cada 5 min)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(now: number, windowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  const cutoff = now - Math.max(windowMs, 15 * 60 * 1000)
  for (const [key, bucket] of buckets) {
    // si el último hit ya está viejo, la cubeta entera sobra
    const last = bucket.hits[bucket.hits.length - 1]
    if (last === undefined || last < cutoff) buckets.delete(key)
  }
}

/** Extrae la IP real (Caddy/Traefik la ponen en X-Forwarded-For) */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Ventana deslizante: cuenta hits de `key` en los últimos `windowMs`.
 * Devuelve ok=false cuando se supera `limit`.
 */
export function rateLimitByKey(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  cleanup(now, windowMs)

  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => t > now - windowMs)

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0]
    buckets.set(key, bucket)
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)
  return { ok: true, remaining: limit - bucket.hits.length, retryAfter: 0 }
}

/** Atajo para rutas Next: limita por IP + nombre de ruta */
export function rateLimit(
  req: Request,
  route: string,
  limit: number,
  windowMs: number = 60_000
) {
  return rateLimitByKey(`${route}:${getClientIp(req)}`, limit, windowMs)
}

/**
 * Versión "peek": consulta el contador SIN sumar un hit.
 * Útil pa' bloquear por cuenta cuando ya se acumularon N fallos.
 */
export function peekRateLimitByKey(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket) return { ok: true, retryAfter: 0 }
  const hits = bucket.hits.filter((t) => t > now - windowMs)
  if (hits.length >= limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)),
    }
  }
  return { ok: true, retryAfter: 0 }
}

/** Respuesta 429 estándar con Retry-After */
export function tooMany(retryAfter: number, msg = 'Demasiadas peticiones. Espera un momentico e inténtalo de nuevo plis 🙏') {
  return Response.json(
    { error: msg },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
