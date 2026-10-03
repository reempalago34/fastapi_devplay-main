/**
 * DDL offline para Supabase (trampa #3: prisma db push se cuelga en pooler).
 * - User.tourCompleted: tour solo para usuarios NUEVOS (existentes → true)
 * - User.language: idioma de la interfaz desde Configuración
 */
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
const client = new pg.Client({ connectionString: url })

await client.connect()
await client.query(`
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tourCompleted" BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';
  UPDATE "User" SET "tourCompleted" = true WHERE "tourCompleted" = false;
`)
const res = await client.query('SELECT COUNT(*)::int AS n FROM "User" WHERE "tourCompleted" = false')
console.log('✅ DDL aplicado. Usuarios con tour pendiente (deben ser 0):', res.rows[0].n)
await client.end()
