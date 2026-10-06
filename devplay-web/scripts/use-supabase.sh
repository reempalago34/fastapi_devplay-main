#!/usr/bin/env bash
# ============================================================
# DevPlay · Cambiar la base de datos a Supabase (PostgreSQL) 🐘
# Uso:  bash scripts/use-supabase.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."

echo "🐘 Cambiando schema de Prisma a PostgreSQL (Supabase)..."

# Respaldar schema SQLite (solo si el respaldo no existe)
[ -f prisma/schema.sqlite.backup.prisma ] || cp prisma/schema.prisma prisma/schema.sqlite.backup.prisma

# Activar el schema de Supabase
cp prisma/schema.supabase.prisma prisma/schema.prisma

# Regenerar cliente Prisma para PostgreSQL
echo "📦 Regenerando cliente Prisma..."
bunx prisma generate

echo ""
echo "✅ Listo. Ahora:"
echo "  1. Pon en tu .env la DATABASE_URL del pooler de Supabase (puerto 6543)"
echo "     Ejemplo: DATABASE_URL=\"postgresql://postgres.TU_REF:TU_PASS@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10\""
echo "  2. Crea las tablas con:  bunx prisma db push"
echo "  3. (Opcional) Copia datos de SQLite → Supabase con:  node scripts/migrate-to-supabase.mjs"
echo "  4. Reinicia el servidor (y el servicio realtime)"
