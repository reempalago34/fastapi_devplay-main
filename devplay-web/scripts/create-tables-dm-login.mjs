/**
 * Crea las tablas nuevas de DevPlay en Supabase vía pg (sin schema engine):
 *   - "LoginCode"      → códigos de acceso por correo al iniciar sesión 🔐
 *   - "DirectMessage"  → mensajería privada 💬
 * Idempotente: CREATE TABLE IF NOT EXISTS.
 */
import pg from 'pg'

const cs = process.env.DATABASE_URL // URL de Supabase — viene del .env (nunca hardcodear)
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15_000 })

const SQL = `
-- ===== LoginCode 🔐 =====
CREATE TABLE IF NOT EXISTS "LoginCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "LoginCode" ADD CONSTRAINT "LoginCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "LoginCode_userId_createdAt_idx" ON "LoginCode"("userId", "createdAt");

-- ===== DirectMessage 💬 =====
CREATE TABLE IF NOT EXISTS "DirectMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "DirectMessage_senderId_recipientId_idx" ON "DirectMessage"("senderId", "recipientId");
CREATE INDEX IF NOT EXISTS "DirectMessage_recipientId_readAt_idx" ON "DirectMessage"("recipientId", "readAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_createdAt_idx" ON "DirectMessage"("createdAt");
`

await client.connect()
console.log('🔌 Conectado a Supabase')
const t = Date.now()
await client.query(SQL)
console.log(`🏗️  DDL ejecutado en ${Date.now() - t}ms`)

const check = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('LoginCode','DirectMessage') ORDER BY 1`)
console.log(`✅ Tablas presentes: ${check.rows.map(r => r.table_name).join(', ')}`)
await client.end()
