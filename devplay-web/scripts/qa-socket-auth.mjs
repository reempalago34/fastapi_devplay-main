// QA: socket.io-client contra el PROXY de Next (:3000) con token VÁLIDO firmado
// de verdad (generado con el mismo secreto REALTIME_SECRET del .env)
import { io } from 'socket.io-client'
import { readFileSync, existsSync } from 'fs'
import { createHmac } from 'crypto'
import { join } from 'path'

// leer secreto del .env (mismo patrón que realtime-service)
const envPath = join(process.cwd(), '.env')
const env = readFileSync(envPath, 'utf-8')
const m = env.match(/^REALTIME_SECRET=(.+)$/m)
const SECRET = m[1].trim()

const exp = Date.now() + 5 * 60_000
const payload = Buffer.from(JSON.stringify({ uid: 'qa-node-uid', un: 'QaNode', exp })).toString('base64url')
const sig = createHmac('sha256', SECRET).update(`${exp}.${payload}`).digest('base64url')
const TOKEN = `${exp}.${payload}.${sig}`

const target = process.argv[2] === 'direct' ? 'http://localhost:3003' : 'http://localhost:3000/?XTransformPort=3003'
console.log(`probando contra: ${target}`)

const socket = io(target, {
  path: '/',
  transports: ['polling', 'websocket'],
  timeout: 10000,
  auth: { token: TOKEN },
})

setTimeout(() => { console.log('⚠️ TIMEOUT 10s sin respuesta'); process.exit(1) }, 11000)

socket.on('connect', () => {
  console.log('✅ CONECTÓ con token válido, id:', socket.id)
  socket.emit('chat:join', {})
  setTimeout(() => {
    socket.emit('chat:message', { content: 'mensaje de QA del blindaje 🔐' })
    setTimeout(() => { socket.close(); process.exit(0) }, 1500)
  }, 300)
})

socket.on('connect_error', (e) => { console.log('connect_error:', e.message); process.exit(1) })
