/**
 * Prueba cuál cuenta de Gmail hace match con la App Password del .env
 * (usa nodemailer verify(): conecta y autentica, NO envía nada)
 */
import nodemailer from 'nodemailer'
import { readFileSync } from 'fs'

// Lee SMTP_PASS del .env manualmente (evita depender del arranque de Next)
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const pass = env.match(/^SMTP_PASS=(.+)$/m)?.[1]?.trim()
if (!pass) { console.error('no hay SMTP_PASS en .env'); process.exit(1) }

const candidates = [
  'frankalexander064@gmail.com',
  'frankaguilar2837@gmail.com',
  'frankqq@gmail.com',
  'frankalexander0646@gmail.com',
  'frankalexander99064@gmail.com',
]

for (const user of candidates) {
  const t = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 12_000,
  })
  try {
    await t.verify()
    console.log(`✅ MATCH: ${user}`)
    process.exit(0)
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 90)
    console.log(`❌ ${user} → ${msg}`)
  }
}
console.log('— ninguna hizo match: la App Password no corresponde a esas cuentas o está mal copiada')
