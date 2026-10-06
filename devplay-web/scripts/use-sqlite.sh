#!/usr/bin/env bash
# ============================================================
# DevPlay · Volver a SQLite (desarrollo local) 💾
# Uso:  bash scripts/use-sqlite.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."

echo "💾 Volviendo a SQLite para desarrollo local..."
if [ -f prisma/schema.sqlite.backup.prisma ]; then
  cp prisma/schema.sqlite.backup.prisma prisma/schema.prisma
else
  echo "⚠️  No hay respaldo del schema SQLite; restaura prisma/schema.prisma a mano (provider = \"sqlite\")."
  exit 1
fi

bunx prisma generate
echo "✅ Listo. Tu .env debe tener DATABASE_URL=file:/ruta/a/db/custom.db"
