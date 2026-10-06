/**
 * Matriz de seguridad de la API DevPlay 🔐 — testing anti-metiches.
 * Estados: ANÓNIMO / INVITADO / LOGUEADO (+ IDOR, payload, rate limit, headers)
 *
 * Uso: DATABASE_URL='...' node scripts/api-security-test.mjs
 * (la BD se usa solo pa' crear el usuario de prueba y borrarlo al final)
 */

import { PrismaClient } from '@prisma/client'

const BASE = 'http://localhost:3000'
const SUPA = process.env.DATABASE_URL
const db = new PrismaClient({ datasources: { db: { url: SUPA } } })

let pass = 0, fail = 0
const results = []

function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  ✅ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; results.push(`  ❌ ${name} — ${detail}`) }
}

async function req(method, path, { body, cookie, raw } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cookie) headers['Cookie'] = cookie
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
    redirect: 'manual',
  })
  const text = await res.text().catch(() => '')
  return { status: res.status, headers: res.headers, text }
}

const EMAIL = `devplay.online+secu${Date.now() % 100000}@gmail.com`
const USER = 'QaSecu' + (Date.now() % 10000)
const PASS = 'SecuPass123*'

async function main() {
  console.log('🔐 MATRIZ DE SEGURIDAD —', new Date().toISOString())

  // ===== 1. ANÓNIMO: writes deben ser 401 =====
  console.log('\n— ANÓNIMO (sin sesión):')
  let r = await req('GET', '/api/devplay/users/me')
  check('GET /users/me sin sesión no revela nada', r.status === 200 && r.text.includes('"user":null'), `status=${r.status}`)

  const writes = [
    ['GET', '/api/devplay/dm', 'lista DM'],
    ['GET', '/api/devplay/dm/usuario-inventado', 'hilo DM'],
    ['POST', '/api/devplay/dm/usuario-inventado', 'enviar DM'],
    ['POST', '/api/devplay/posts', 'crear post'],
    ['PATCH', '/api/devplay/users/me/profile', 'editar perfil'],
    ['GET', '/api/devplay/realtime-token', 'token realtime'],
    ['POST', '/api/devplay/store/buy', 'comprar'],
    ['POST', '/api/devplay/follow', 'seguir'],
    ['DELETE', '/api/devplay/follow', 'dejar de seguir'],
    ['POST', '/api/devplay/security/block', 'bloquear'],
    ['POST', '/api/devplay/security/report', 'reportar'],
    ['POST', '/api/devplay/security/account', 'eliminar cuenta'],
    ['POST', '/api/devplay/streams/go-live', 'ir en vivo'],
    ['POST', '/api/devplay/buddy', 'asistente IA'],
    ['POST', '/api/devplay/chat', 'borrar chat mundial'],
  ]
  for (const [m, p, name] of writes) {
    r = await req(m, p, { body: m !== 'GET' && m !== 'DELETE' ? {} : undefined })
    const ok = r.status === 401 || r.status === 403 || r.status === 405
    check(`sin sesión → ${name} bloqueado`, ok, `status=${r.status}`)
  }
  // Rutas "fail-safe": 200 pero con datos VACÍOS (no filtran nada)
  r = await req('GET', '/api/devplay/security/login-events')
  check('sin sesión → login-events solo [] (sin filtración)', r.status === 200 && r.text.replace(/\s/g, '') === '{"events":[]}', `status=${r.status} ${r.text.slice(0, 40)}`)
  r = await req('GET', '/api/devplay/users/me/stats')
  check('sin sesión → stats solo null (sin filtración)', r.status === 200 && r.text.replace(/\s/g, '') === '{"stats":null}', `status=${r.status} ${r.text.slice(0, 40)}`)
  r = await req('GET', '/api/devplay/store/balance')
  check('sin sesión → balance solo 0 (sin filtración)', r.status === 200 && r.text.includes('"balance":0') && !r.text.includes('username'), `status=${r.status} ${r.text.slice(0, 40)}`)

  // ===== 2. Anónimo: lecturas públicas OK (contenido público) =====
  console.log('\n— LECTURAS PÚBLICAS (deben ser 200):')
  for (const [m, p, name] of [
    ['GET', '/api/devplay/posts', 'feed'],
    ['GET', '/api/devplay/store/items', 'catálogo tienda'],
    ['GET', '/api/devplay/users/by-username/noexiste99', 'perfil por username'],
    ['GET', '/api/health', 'health'],
  ]) {
    r = await req(m, p)
    const ok = r.status === 200 || r.status === 404
    check(`${name} público OK`, ok, `status=${r.status}`)
  }

  // ===== 3. IDOR / recursos inexistentes no explotan =====
  console.log('\n— IDOR / RECURSOS FANTASMA:')
  r = await req('GET', '/api/devplay/users/cuid-que-no-existe-123')
  check('GET user por id fantasma → 404 sin filtrar', r.status === 404 || r.status === 400, `status=${r.status}`)
  r = await req('GET', '/api/devplay/posts/id-fantasma/likes')
  check('likes de post fantasma → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`)
  r = await req('GET', '/api/devplay/betas/id-fantasma/download')
  check('descarga beta fantasma → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`)

  // ===== 4. Middleware: payload gigante + headers + traversal =====
  console.log('\n— MIDDLEWARE / HEADERS / TRAVERSAL:')
  r = await req('POST', '/api/devplay/dm/xxx', { body: 'x'.repeat(1_200_000), raw: true })
  check('payload >1MB → 413', r.status === 413, `status=${r.status}`)

  r = await req('GET', '/')
  const csp = r.headers.get('content-security-policy') || ''
  check('CSP presente', csp.includes('frame-ancestors'), csp.slice(0, 40) + '…')
  check('nosniff presente', r.headers.get('x-content-type-options') === 'nosniff')
  check('HSTS presente', (r.headers.get('strict-transport-security') || '').includes('max-age'))

  r = await req('GET', '/.env')
  check('/.env NO expuesto', r.status === 404, `status=${r.status}`)
  r = await req('GET', '/uploads/%2e%2e/%2e%2e/.env')
  check('traversal a .env bloqueado', r.status === 404 || r.status === 400, `status=${r.status}`)
  r = await req('GET', '/uploads/definitivamente-no-existe.png')
  check('uploads sin listado ni fantasmas → 404', r.status === 404, `status=${r.status}`)

  // ===== 5. INVITADO: puede leer pero NO escribir =====
  console.log('\n— INVITADO:')
  r = await req('POST', '/api/devplay/auth/guest', { body: {} })
  const guestOk = r.status === 200
  const guestId = guestOk ? (JSON.parse(r.text).id ?? JSON.parse(r.text).user?.id) : null
  check('crear invitado', guestOk && !!guestId, `status=${r.status}`)
  if (guestId) {
    const gc = `devplay-guest-id=${guestId}`
    r = await req('GET', '/api/devplay/users/me', { cookie: gc })
    check('invitado ve su /users/me', r.status === 200 && r.text.includes('"isGuest":true'), `status=${r.status}`)
    r = await req('POST', '/api/devplay/posts', { cookie: gc, body: { content: 'hola', type: 'POST' } })
    check('invitado NO puede publicar', r.status === 401 || r.status === 403, `status=${r.status}`)
    r = await req('GET', '/api/devplay/dm', { cookie: gc })
    check('invitado NO ve DMs', r.status === 401 || r.status === 403, `status=${r.status}`)
    r = await req('GET', '/api/devplay/realtime-token', { cookie: gc })
    check('invitado SIN token realtime (chat exige cuenta)', r.status === 401 || r.status === 403, `status=${r.status}`)
  }

  // ===== 6. LOGUEADO: flujo completo legítimo =====
  console.log('\n— LOGUEADO (usuario de prueba):')
  r = await req('POST', '/api/devplay/auth/register', { body: { email: EMAIL, username: USER, password: PASS, fullName: 'QA Secu', age: 22 } })
  const regOk = r.status === 200 && JSON.parse(r.text).ok
  check('registro legítimo OK', regOk, `status=${r.status} ${r.text.slice(0, 60)}`)

  // código por IMAP
  const { execSync } = await import('child_process')
  let code = ''
  try {
    code = execSync(`cd scripts/imap && node get-code.mjs ${EMAIL} 2>/dev/null | tail -1`, { encoding: 'utf8', timeout: 60_000 }).replace('CODIGO:', '').trim()
  } catch { /* retry abajo */ }
  if (!/^\d{6}$/.test(code)) {
    await new Promise((s) => setTimeout(s, 8000))
    try {
      code = execSync(`cd scripts/imap && node get-code.mjs ${EMAIL} 2>/dev/null | tail -1`, { encoding: 'utf8', timeout: 60_000 }).replace('CODIGO:', '').trim()
    } catch {}
  }
  check('código 6 dígitos llegó por correo real', /^\d{6}$/.test(code), `código=${code}`)

  let jar = ''
  if (/^\d{6}$/.test(code)) {
    r = await req('POST', '/api/devplay/auth/verify-register', { body: { email: EMAIL, code } })
    check('verify-register OK', r.status === 200, `status=${r.status}`)
    // login credentials con CSRF vía curl (método probado en E2E real)
    const JAR = '/tmp/jar-sec.txt'
    try {
      execSync(`curl -sS -m 20 -c ${JAR} ${BASE}/api/auth/csrf -o /tmp/csrf-sec.json`, { timeout: 30_000 })
      const csrf = JSON.parse(await import('fs').then((f) => f.readFileSync('/tmp/csrf-sec.json', 'utf8'))).csrfToken
      execSync(`curl -sS -m 30 -b ${JAR} -c ${JAR} -X POST ${BASE}/api/auth/callback/credentials -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode 'email=${EMAIL}' --data-urlencode 'password=${PASS}' --data-urlencode 'csrfToken=${csrf}' --data-urlencode 'json=true'`, { timeout: 40_000 })
      const jarLines = (await import('fs')).readFileSync(JAR, 'utf8').split('\n')
      const cookies = jarLines
        .filter((l) => l && !l.startsWith('# ') && l.split('\t').length >= 7)
        .map((l) => l.split('\t'))
        .filter((f) => f[5] === 'next-auth.session-token' || f[5] === 'next-auth.csrf-token')
        .map((f) => `${f[5]}=${f[6]}`)
      jar = cookies.join('; ')
    } catch (e) {
      check('login credentials → sesión válida', false, 'curl login falló: ' + String(e).slice(0, 60))
    }
    r = await req('GET', '/api/devplay/users/me', { cookie: jar })
    check('login credentials → sesión válida', r.status === 200 && r.text.includes(USER), `status=${r.status}`)

    if (jar) {
      r = await req('GET', '/api/devplay/realtime-token', { cookie: jar })
      check('logueado SÍ obtiene token realtime', r.status === 200 && r.text.includes('token'), `status=${r.status}`)
      r = await req('POST', '/api/devplay/posts', { cookie: jar, body: { content: 'Post de prueba de seguridad 🔐', type: 'POST' } })
      const postId = r.status === 200 ? JSON.parse(r.text)?.post?.id ?? JSON.parse(r.text)?.id : null
      check('logueado publica OK', r.status === 200, `status=${r.status}`)
      // IDOR: intentar modificar contenido de OTRO (no hay ruta de edición de otros: comprobar 404)
      r = await req('PATCH', '/api/devplay/posts/id-de-otro', { cookie: jar, body: { content: 'hack?' } })
      check('PATCH post ajeno → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`)
      r = await req('POST', '/api/devplay/posts/id-fantasma/comments', { cookie: jar, body: { content: 'x' } })
      check('comentar post fantasma → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`)
      // limpiar post de prueba
      if (postId) {
        const d = await req('DELETE', `/api/devplay/posts/${postId}`, { cookie: jar })
        check('borra su propio post (cleanup)', d.status === 200 || d.status === 404, `status=${d.status}`)
      }
    }
  }

  // ===== 7. Rate limit de registro (5/min por IP) =====
  console.log('\n— RATE LIMIT (bots):')
  const statuses = []
  let got429 = false
  for (let i = 0; i < 7; i++) {
    r = await req('POST', '/api/devplay/auth/register', { body: { email: `spamx${i}@x.com`, username: `spamx${i}`, password: 'xxxxxx', fullName: 'Spam Bot', age: 20 } })
    statuses.push(r.status)
    if (r.status === 429) got429 = true
  }
  check('register bloquea bots con 429', got429, `estados=${statuses.join(',')}`)

  console.log('\n' + results.join('\n'))
  console.log(`\n📊 RESULTADO: ${pass} PASS · ${fail} FAIL`)

  // ===== 8. Limpieza: borrar usuario de prueba =====
  const u = await db.user.findUnique({ where: { username: USER } })
  if (u) {
    await db.user.delete({ where: { id: u.id } })
    console.log('🧹 usuario de prueba borrado:', USER)
  }
  const spam = await db.user.deleteMany({ where: { username: { startsWith: 'spamx' } } })
  console.log('🧹 bots de prueba borrados:', spam.count)
  console.log('usuarios en BD:', await db.user.count())
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => db.$disconnect())
