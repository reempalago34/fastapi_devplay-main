/** SELECT rápido de usuarios. Uso: bun scripts/q-users.mjs <ilike> */
import pg from 'pg'
const cs = process.env.DATABASE_URL // URL de Supabase — viene del .env (nunca hardcodear)
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } })
await c.connect()
const pat = process.argv[2] || '%qaB%'
const r = await c.query(`SELECT username, "isGuest", role, "createdAt" FROM "User" WHERE username ILIKE $1 LIMIT 10`, [pat])
console.table(r.rows.map(u => ({ ...u, createdAt: new Date(u.createdAt).toISOString().slice(0, 16) })))
await c.end()
