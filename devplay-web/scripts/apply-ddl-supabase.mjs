/**
 * Ejecuta el DDL de DevPlay (db/supabase-schema.sql) en Supabase vía pg.
 * Muestra tablas existentes antes, y el listado final después.
 */
import pg from 'pg'
import { readFileSync } from 'fs'

const cs = process.env.DATABASE_URL // URL de Supabase — viene del .env (nunca hardcodear)
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15_000 })

await client.connect()
console.log('🔌 Conectado a Supabase')

// ¿Qué hay ya en public?
const before = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`)
console.log(`📋 Tablas existentes en public: ${before.rows.length === 0 ? '(ninguna — limpio ✨)' : before.rows.map(r => r.table_name).join(', ')}`)

if (before.rows.length > 0) {
  console.log('⚠️ Ya hay tablas — no ejecuto el DDL para no pisar nada. Revisa primero.')
  await client.end()
  process.exit(1)
}

// Ejecutar DDL completo
const sql = readFileSync(new URL('../db/supabase-schema.sql', import.meta.url), 'utf8')
const t = Date.now()
await client.query(sql)
console.log(`🏗️  DDL ejecutado en ${Date.now() - t}ms`)

const after = await client.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`)
console.log(`✅ Tablas creadas en Supabase: ${after.rows[0].n}`)
await client.end()
