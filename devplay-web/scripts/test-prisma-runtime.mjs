import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const t = Date.now()
const n = await db.user.count()
console.log(`✅ Runtime Prisma conectó a Supabase en ${Date.now() - t}ms — usuarios en nube: ${n}`)
await db.$disconnect()
