/**
 * Crea un LoginCode de prueba con código conocido para un email dado.
 * Uso: bun scripts/mk-code.mjs <email> <codigo6digitos>
 * (los códigos reales van hasheados con bcrypt igual que createLoginCode)
 */
import pg from 'pg'
import bcrypt from 'bcryptjs'

const [email, code] = process.argv.slice(2)
if (!email || !code || !/^\d{6}$/.test(code)) {
  console.log('Uso: bun scripts/mk-code.mjs <email> <codigo6digitos>')
  process.exit(1)
}

const cs = process.env.DATABASE_URL // URL de Supabase — viene del .env (nunca hardcodear)
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
await client.connect()

const u = await client.query(`SELECT id, username FROM "User" WHERE email = $1`, [email.toLowerCase()])
if (!u.rows[0]) {
  console.log(`FAIL: no existe usuario con email ${email}`)
  process.exit(1)
}

// Si --clean: borra códigos previos del usuario para que ESTE sea el más reciente
// (verifyLoginCode siempre usa el más reciente; útil tras pasar por login-challenge)
if (process.argv.includes('--clean')) {
  const del = await client.query(`DELETE FROM "LoginCode" WHERE "userId" = $1`, [u.rows[0].id])
  console.log(`códigos previos borrados: ${del.rowCount}`)
}

const id = `qa_${Date.now().toString(36)}`
await client.query(
  `INSERT INTO "LoginCode" ("id","userId","codeHash","expiresAt","attempts","createdAt") VALUES ($1,$2,$3,$4,0,NOW())`,
  [id, u.rows[0].id, bcrypt.hashSync(code, 8), new Date(Date.now() + 10 * 60 * 1000)]
)
console.log(`OK codigo ${code} creado para ${u.rows[0].username} (${email}) — caduca en 10 min`)
await client.end()
