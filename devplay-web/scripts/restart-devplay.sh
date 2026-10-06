#!/usr/bin/env bash
# ============================================================
# DevPlay · Reinicio completo con Supabase 🐘
# Uso:  bash scripts/restart-devplay.sh
#
# ⚠️ IMPORTANTE: este entorno (sandbox) exporta DATABASE_URL=file:...
#    globalmente y pisa el .env. Por eso SIEMPRE se pasa la URL de
#    Supabase inline al arrancar ambos servicios.
# ============================================================
set -e
cd "$(dirname "$0")/.."

# ⚠️ La URL de Supabase vive SOLO en el .env (nunca hardcodeada aquí).
SUPA_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
if [ -z "$SUPA_URL" ]; then
  echo "❌ No hay DATABASE_URL en .env — restauralo antes de reiniciar (ver worklog, trampa #2)"
  exit 1
fi

# Secretos de seguridad (tarea 33) — se leen del .env del repo si existen
NA_SECRET=$(grep -E '^NEXTAUTH_SECRET=' .env | head -1 | cut -d= -f2-)
RT_SECRET=$(grep -E '^REALTIME_SECRET=' .env | head -1 | cut -d= -f2-)

echo "🛑 Matando servicios..."
pkill -9 -f next-server 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "bun --hot index.ts" 2>/dev/null || true
sleep 1

echo "🐘 Arrancando web (puerto 3000) con Supabase..."
rm -rf .next
( cd /home/z/my-project && DATABASE_URL="$SUPA_URL" NEXTAUTH_SECRET="$NA_SECRET" REALTIME_SECRET="$RT_SECRET" setsid bun run dev > .zscripts/next-direct.log 2>&1 < /dev/null & )

echo "🔌 Arrancando realtime (puerto 3003) con Supabase..."
( cd /home/z/my-project/mini-services/realtime-service && DATABASE_URL="$SUPA_URL" REALTIME_SECRET="$RT_SECRET" NEXTAUTH_SECRET="$NA_SECRET" setsid bun run dev > /home/z/my-project/.zscripts/realtime-supabase.log 2>&1 < /dev/null & )

echo ""
echo "✅ Listo. Verifica con:"
echo "   curl http://localhost:3000/api/health   → debe decir db:up"
