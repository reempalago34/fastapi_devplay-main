/**
 * Limpieza de cuentas QA 🧹 — elimina los usuarios de prueba creados
 * durante el test E2E del flujo de registro/login con código.
 * (relaciones en cascada: LoginCode, DMs, etc.)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const QA_EMAILS = [
  'frankalexander064+qa1@gmail.com',
  'frankalexander064+qa2@gmail.com',
  'frankalexander064+qa3@gmail.com',
  'frankalexander064+recup@gmail.com',
  'devplay.online+edad@gmail.com',
  'devplay.online+edad2@gmail.com',
]

for (const email of QA_EMAILS) {
  const u = await db.user.findUnique({ where: { email } })
  if (!u) { console.log(`· ${email}: no existe (nada que borrar)`); continue }
  await db.user.delete({ where: { email } })
  console.log(`🗑 borrada cuenta QA: ${u.username} (${email})`)
}

const total = await db.user.count()
console.log(`→ usuarios restantes en la BD: ${total}`)
await db.$disconnect()
