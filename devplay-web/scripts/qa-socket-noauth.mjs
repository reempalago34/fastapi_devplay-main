// QA blindaje: conectar al realtime SIN token → debe ser rechazado
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', {
  path: '/',
  transports: ['websocket', 'polling'],
  timeout: 8000,
  auth: { token: '' }, // sin token (simula atacante)
})

const timer = setTimeout(() => {
  console.log('⚠️ TIMEOUT: el socket no fue rechazado ni conectado en 8s')
  process.exit(1)
}, 9000)

socket.on('connect', () => {
  clearTimeout(timer)
  console.log('⚠️⚠️ CONECTÓ SIN TOKEN — FALLA DE SEGURIDAD')
  process.exit(1)
})

socket.on('connect_error', (err) => {
  clearTimeout(timer)
  console.log(`✅ Handshake rechazado correctamente → "${err.message}"`)
  process.exit(0)
})
