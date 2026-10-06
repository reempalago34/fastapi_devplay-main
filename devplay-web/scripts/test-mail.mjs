/**
 * DevPlay · Prueba de SMTP 🔬
 * Lee las credenciales del .env y envía un correo de prueba AL REMITENTE
 * mismo (bucle a ti mismo). Sirve para verificar:
 *   1. Que las credenciales Gmail funcionan
 *   2. Qué nombre de remitente ve quien recibe (¿"DevPlay" o el nombre del perfil Google?)
 */
import { readFileSync } from 'node:fs'
import nodemailer from 'nodemailer'

// Parse mínimo del .env (soporta valores con comillas)
const envTxt = readFileSync('/home/z/my-project/.env', 'utf8')
const env = {}
for (const line of envTxt.split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const HOST = env.SMTP_HOST
const PORT = Number(env.SMTP_PORT || 465)
const USER = env.SMTP_USER
const PASS = env.SMTP_PASS
const FROM = env.MAIL_FROM || `DevPlay <${USER}>`

if (!HOST || !USER || !PASS) {
  console.error('❌ Faltan SMTP_HOST/SMTP_USER/SMTP_PASS en .env')
  process.exit(1)
}

console.log(`SMTP: ${HOST}:${PORT} · usuario: ${USER}`)
console.log(`From header: ${FROM}`)

try {
  const t = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  const info = await t.sendMail({
    from: FROM,
    to: process.argv[2] || USER, // por defecto: bucle a ti mismo; o pasa un destino como argv
    subject: 'Prueba de remitente · DevPlay 🧪',
    text: 'Si lees esto, el SMTP de DevPlay funciona. Revisa el NOMBRE del remitente: debería decir "DevPlay".',
    html: `<div style="font-family:Georgia,serif;background:#FBF3E4;border:3px solid #4A2E21;border-radius:14px;padding:24px;max-width:480px;margin:auto;">
      <h2 style="color:#4A2E21;margin:0 0 8px;">🧪 Prueba de remitente</h2>
      <p style="color:#4A2E21;line-height:1.6;">El SMTP de DevPlay <b>funciona</b> ✅</p>
      <p style="color:#C66E41;font-weight:bold;">Mira ARRIBA: ¿el remitente dice "DevPlay" o "Meli"?</p>
      <p style="color:#7A8B4C;font-size:13px;">— el hombrecito robot de DevPlay 🤖</p>
    </div>`,
  })

  console.log('✅ Correo ENVIADO — id:', info.messageId)
  console.log('   → Revisa la bandeja de', USER, 'y mira el nombre del remitente')
} catch (e) {
  console.error('❌ Error SMTP:', e.message)
  process.exit(1)
}
