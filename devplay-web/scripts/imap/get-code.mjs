/**
 * Lee el último correo de DevPlay en la bandeja (Gmail IMAP con app password)
 * y extrae el código de 6 dígitos. Uso: bun get-code.mjs [destinatario]
 */
import { ImapFlow } from 'imapflow'
import { readFileSync } from 'node:fs'

const envTxt = readFileSync('/home/z/my-project/.env', 'utf8')
const env = {}
for (const line of envTxt.split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  logger: false,
})

const wanted = (process.argv[2] || '').toLowerCase() // filtro opcional por destinatario

await client.connect()
const lock = await client.getMailboxLock('INBOX')
try {
  // Busca los 12 más recientes y toma el último que coincida
  const uids = await client.search({ since: new Date(Date.now() - 2 * 60 * 60 * 1000) })
  console.error('UIDS_2H:', uids?.length || 0)
  if (!uids || !uids.length) {
    const all = await client.search({ all: true })
    console.error('UIDS_ALL:', all?.slice(-5) || 0)
    console.log('NO_MAIL'); process.exit(0)
  }
  const recent = uids.slice(-12).reverse()

  for (const uid of recent) {
    const msg = await client.fetchOne(String(uid), { envelope: true, source: true })
    if (!msg) { console.error(`UID ${uid}: sin datos`); continue }
    const to = (msg.envelope.to || []).map(t => t.address).join(',').toLowerCase()
    const subj = (msg.envelope.subject || '')
    console.error(`UID ${uid} · "${subj}" · to=${to}`)
    if (wanted && !to.includes(wanted)) continue
    if (!/devplay/i.test(subj)) continue

    console.log('ASUNTO:', subj)
    console.log('PARA:', to)
    console.log('FECHA:', msg.envelope.date?.toISOString())
    // Extrae el código de 6 dígitos del HTML (está en un span grande con letter-spacing)
    const body = msg.source.toString()
    const m = body.match(/\b(\d{6})\b/)
    console.log('CODIGO:', m ? m[1] : 'NO_ENCONTRADO')
    process.exit(0)
  }
  console.log('NO_MATCH')
} finally {
  lock.release()
  await client.logout()
}
