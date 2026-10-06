/**
 * QA DevPlay (pedido del dueño: "verifica cada boton y evalua que funcione bien")
 *  1) Registro de 2 usuarios de prueba (example.com → el correo de bienvenida
 *     falla en silencio, no pasa nada)
 *  2) Login clásico (email+contraseña, camino 2 de authorize)
 *  3) Follow mutuo + contadores
 *  4) BLOQUEAR: POST block → verifica follow borrado, DM rechazada (403),
 *     feed filtrado, fila en Supabase
 *  5) DESBLOQUEAR: DELETE → verifica fila fuera y DM permitida
 *  6) OTP real: login-challenge → demoCode (SMTP falla con example.com) →
 *     código incorrecto rechazado → código correcto crea sesión (camino 1)
 */
import pg from 'pg'
import bcrypt from 'bcryptjs'

const BASE = 'http://localhost:3000'
const SUPA = process.env.DATABASE_URL // URL de Supabase — viene del .env (nunca hardcodear)

const STAMP = Date.now().toString(36).slice(-5)
const A = { email: `qa.a.${STAMP}@example.com`, username: `qaA${STAMP}`, password: 'devplay123' }
const B = { email: `qa.b.${STAMP}@example.com`, username: `qaB${STAMP}`, password: 'devplay123' }

let ok = 0, fail = 0
function check(name, cond, extra = '') {
  console.log(`${cond ? 'OK ' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  cond ? ok++ : fail++
}

function jar() {
  const m = new Map()
  return {
    get: () => [...m.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    set: (res) => {
      const sc = res.headers.getSetCookie?.() || []
      for (const c of sc) {
        const pair = c.split(';')[0]
        const i = pair.indexOf('=')
        m.set(pair.slice(0, i), pair.slice(i + 1))
      }
    },
  }
}

async function login(email, password, j, code) {
  const r1 = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: j.get() } })
  j.set(r1)
  const { csrfToken } = await r1.json()
  const form = new URLSearchParams({ csrfToken, json: 'true' })
  if (code) form.set('code', code)
  else form.set('password', password || '')
  form.set('email', email)
  const r2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: j.get() },
    body: form,
    redirect: 'manual',
  })
  j.set(r2)
  const r3 = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: j.get() } })
  j.set(r3)
  return r3.json()
}

// ===== 1) Registros =====
for (const u of [A, B]) {
  const r = await fetch(`${BASE}/api/devplay/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(u),
  })
  const j = await r.json().catch(() => ({}))
  check(`registro ${u.username}`, r.ok, `id=${j?.id || '?'}`)
}

// ===== 2) Logins clásicos =====
const jarA = jar(), jarB = jar()
const sA = await login(A.email, A.password, jarA)
const sB = await login(B.email, B.password, jarB)
check('sesion A (email+pass)', !!sA?.user?.id, `user=${sA?.user?.name || '?'}`)
check('sesion B (email+pass)', !!sB?.user?.id, `user=${sB?.user?.name || '?'}`)
const idA = sA?.user?.id, idB = sB?.user?.id

if (!idA || !idB) {
  console.log('\nNo hay sesiones — abortando (¿servidor caido?)')
  process.exit(1)
}

// ===== 3) Follow mutuo + contadores =====
await fetch(`${BASE}/api/devplay/follow`, {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: jarA.get() },
  body: JSON.stringify({ followeeId: idB }),
})
await fetch(`${BASE}/api/devplay/follow`, {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: jarB.get() },
  body: JSON.stringify({ followeeId: idA }),
})
const pA = await fetch(`${BASE}/api/devplay/users/${idA}`, { headers: { cookie: jarB.get() } }).then(r => r.json())
check('B sigue a A (isFollowing)', pA?.user?.isFollowing === true)
check('A muestra followersCount=1', pA?.user?.followersCount === 1, `followers=${pA?.user?.followersCount}`)
check('A muestra followingCount=1', pA?.user?.followingCount === 1, `following=${pA?.user?.followingCount}`)

// ===== 4) BLOQUEAR =====
// B publica un post para probar el filtro del feed
const postRes = await fetch(`${BASE}/api/devplay/posts`, {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: jarB.get() },
  body: JSON.stringify({ content: `post QA bloqueo ${STAMP}`, type: 'POST' }),
})
const postJson = await postRes.json().catch(() => null)
check('B publica post de prueba', postRes.ok, postJson?.post?.id || postJson?.id || JSON.stringify(postJson)?.slice(0, 60))

const feed1 = await fetch(`${BASE}/api/devplay/posts`, { headers: { cookie: jarA.get() } }).then(r => r.json())
const sawBefore = JSON.stringify(feed1).includes(`post QA bloqueo ${STAMP}`)
check('feed de A ve el post de B (antes de block)', sawBefore)

const rb = await fetch(`${BASE}/api/devplay/security/block`, {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: jarA.get() },
  body: JSON.stringify({ blockedId: idB }),
}).then(r => r.json())
check('POST block A→B', rb?.blocked === true, JSON.stringify(rb))

const pA2 = await fetch(`${BASE}/api/devplay/users/${idA}`, { headers: { cookie: jarB.get() } }).then(r => r.json())
check('follow B→A borrado tras block', pA2?.user?.isFollowing === false)

const feed2 = await fetch(`${BASE}/api/devplay/posts`, { headers: { cookie: jarA.get() } }).then(r => r.json())
const sawAfter = JSON.stringify(feed2).includes(`post QA bloqueo ${STAMP}`)
check('feed de A ya NO ve el post de B', sawBefore ? !sawAfter : true, sawBefore ? '' : '(post no se creo; filtro no testeable)')

const dmBlocked = await fetch(`${BASE}/api/devplay/dm/${idA}`, {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: jarB.get() },
  body: JSON.stringify({ content: 'hola QA intento bloqueado' }),
})
check('DM B→A rechazada por bloqueo (403)', dmBlocked.status === 403, `status=${dmBlocked.status}`)

// fila en Supabase
const pgc = new pg.Client({ connectionString: SUPA, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
await pgc.connect()
const rows = await pgc.query(`SELECT "blockerId","blockedId" FROM "Block" WHERE "blockerId"=$1 AND "blockedId"=$2`, [idA, idB])
check('fila Block en Supabase', rows.rowCount === 1)

// ===== 5) DESBLOQUEAR =====
const ru = await fetch(`${BASE}/api/devplay/security/block?blockedId=${idB}`, {
  method: 'DELETE', headers: { cookie: jarA.get() },
}).then(r => r.json())
check('DELETE unblock', ru?.blocked === false, JSON.stringify(ru))

const rows2 = await pgc.query(`SELECT 1 FROM "Block" WHERE "blockerId"=$1 AND "blockedId"=$2`, [idA, idB])
check('fila Block eliminada de Supabase', rows2.rowCount === 0)

const dm2 = await fetch(`${BASE}/api/devplay/dm/${idA}`, {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: jarB.get() },
  body: JSON.stringify({ content: 'ya no estoy bloqueado QA' }),
})
check('DM B→A permitida tras desbloquear', dm2.ok, `status=${dm2.status}`)

// ===== 6) OTP real: challenge valida credenciales + crea LoginCode =====
const ch = await fetch(`${BASE}/api/devplay/auth/login-challenge`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: B.email, password: B.password }),
}).then(r => r.json())
check('login-challenge valida y genera codigo', ch?.ok === true && !!ch?.sentTo, `sentTo=${ch?.sentTo}`)
const lcB = await pgc.query(`SELECT id FROM "LoginCode" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1`, [idB])
check('fila LoginCode creada en Supabase', lcB.rowCount === 1)

// Camino OTP completo para A: insertamos un codigo hasheado conocido ('543210')
// (el hash va con bcrypt igual que createLoginCode → prueba verifyLoginCode E2E)
const codeHash = bcrypt.hashSync('543210', 8)
await pgc.query(
  `INSERT INTO "LoginCode" ("id","userId","codeHash","expiresAt","attempts","createdAt") VALUES ($1,$2,$3,$4,0,NOW())`,
  [`qa_otp_${STAMP}`, idA, codeHash, new Date(Date.now() + 10 * 60 * 1000)]
)
const jarE = jar()
const sE0 = await login(A.email, null, jarE, '111111')
check('codigo INCORRECTO no crea sesion', !sE0?.user?.id)
const sE = await login(A.email, null, jarE, '543210')
check('sesion con CODIGO de acceso (camino OTP)', !!sE?.user?.id, `user=${sE?.user?.name || '?'}`)
const used = await pgc.query(`SELECT "usedAt" FROM "LoginCode" WHERE id=$1`, [`qa_otp_${STAMP}`])
check('codigo queda marcado como USADO (un solo uso)', !!used.rows[0]?.usedAt)

await pgc.end()
console.log(`\n=== QA: ${ok} OK / ${fail} FALLIDOS ===`)
process.exit(fail ? 1 : 0)
