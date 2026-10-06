import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health — latido del corazón de DevPlay 💓
 *
 * Dos usos:
 *  1. Monitor: apunta un cron gratuito (cron-job.org, UptimeRobot) cada 2-3 días
 *     a este endpoint → cada visita cuenta como "actividad" y el plan gratuito
 *     NUNCA pausa la base de datos (la pausa es a los 7 días sin uso).
 *  2. Diagnóstico: responde si la web y la API/BD están vivas y cuánto tardó.
 *
 * Ahora delega en la API de FastAPI (`GET /api/v1/health`), que es quien
 * habla con PostgreSQL. Antes contaba usuarios con Prisma; ese count ya no
 * tiene sentido aquí porque el frontend no tiene acceso a la BD.
 *
 * Devuelve 200 si todo va bien, 503 si la API no responde (así el monitor avisa).
 */
export async function GET(_req: NextRequest) {
  const startedAt = Date.now()
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/health`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`la API respondió ${res.status}`)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({
      ok: true,
      db: data?.database === 'ok' ? 'up' : 'unknown',
      app: data?.app ?? 'DevPlay API',
      env: data?.env ?? null,
      ms: Date.now() - startedAt,
      time: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[health] la API no responde:', err instanceof Error ? err.message.slice(0, 150) : err)
    return NextResponse.json(
      { ok: false, db: 'down', ms: Date.now() - startedAt, time: new Date().toISOString() },
      { status: 503 }
    )
  }
}