/**
 * Diagnóstico de conexión a Supabase (pooler) a nivel protocolo PostgreSQL.
 * Prueba los 3 modos: transaction pooler (6543), session pooler (5432),
 * directa (db.xxx:5432). Timeout corto y error real visible.
 */
import pg from 'pg'

const REF = 'uizpoczewriaxbpsjena'
const PASS_ENC = (process.env.DATABASE_URL || '').match(/://[^:]+:([^@]+)@/)?.[1] || '' // pass sale del .env (nunca hardcodear)

const targets = [
  { name: 'Transaction pooler 6543', host: `aws-0-us-east-2.pooler.supabase.com`, port: 6543, user: `postgres.${REF}` },
  { name: 'Session pooler 5432', host: `aws-0-us-east-2.pooler.supabase.com`, port: 5432, user: `postgres.${REF}` },
  { name: 'Directa 5432', host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
]

for (const t of targets) {
  const cs = `postgresql://${t.user}:${PASS_ENC}@${t.host}:${t.port}/postgres`
  const client = new pg.Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12_000,
  })
  const started = Date.now()
  try {
    await client.connect()
    const r = await client.query('select version()')
    console.log(`✅ [${t.name}] CONECTÓ en ${Date.now() - started}ms → ${r.rows[0].version.slice(0, 60)}`)
    await client.end()
    process.exit(0)
  } catch (e) {
    console.log(`❌ [${t.name}] ${Date.now() - started}ms → ${(e.message || e).toString().split('\n')[0].slice(0, 140)}`)
    try { await client.end() } catch {}
  }
}
console.log('— fin de diagnóstico')
