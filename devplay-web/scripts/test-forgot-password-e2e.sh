#!/bin/bash
# ============================================================
# Prueba E2E REAL de recuperación de contraseña 🔑
#   1. Registra cuenta QA (frankalexander064+recup@gmail.com → alias Gmail)
#   2. Pide código de recuperación (forgot-password) → SMTP real
#   3. Lee el código REAL de la bandeja vía IMAP
#   4. Restablece la contraseña (reset-password)
#   5. Comprueba: contraseña VIEJA rechazada, NUEVA aceptada
# ============================================================
set -u
BASE="http://localhost:3000/api/devplay/auth"
QA_EMAIL="frankalexander064+recup@gmail.com"
QA_USER="qa_recup_$(date +%s | tail -c 5)"
OLD_PASS="qaVieja123"
NEW_PASS="qaNueva456"

step() { echo; echo "==> $1"; }

# ---------- helper IMAP con reintentos (el correo tarda en llegar) ----------
leer_codigo() {
  for i in 1 2 3 4 5 6; do
    out=$(cd /home/z/my-project/scripts/imap && bun get-code.mjs "+recup" 2>/dev/null)
    code=$(echo "$out" | grep '^CODIGO:' | awk '{print $2}')
    if [ -n "$code" ] && [ "$code" != "NO_ENCONTRADO" ]; then
      echo "$code"; return 0
    fi
    echo "   (intento $i: aún no llega, esperando 5s...)" >&2
    sleep 5
  done
  return 1
}

step "1/6 Registro de cuenta QA: $QA_USER <$QA_EMAIL> (pass: $OLD_PASS)"
r1=$(curl -s -X POST "$BASE/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$QA_EMAIL\",\"username\":\"$QA_USER\",\"password\":\"$OLD_PASS\"}")
echo "$r1"
echo "$r1" | grep -q '"ok":true' || { echo "❌ FALLO el registro"; exit 1; }

step "2/6 Pidiendo código de recuperación (forgot-password, SMTP real)"
r2=$(curl -s -X POST "$BASE/forgot-password" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$QA_EMAIL\"}")
echo "$r2"
echo "$r2" | grep -q '"ok":true' || { echo "❌ FALLO forgot-password"; exit 1; }

step "3/6 Leyendo el código REAL de la bandeja (IMAP Gmail)..."
code=$(leer_codigo)
[ -n "$code" ] || { echo "❌ El código nunca llegó a la bandeja"; exit 1; }
echo "   ✅ Código real recibido por correo: $code"

step "4/6 Restableciendo contraseña a: $NEW_PASS (con el código leído del correo)"
r4=$(curl -s -X POST "$BASE/reset-password" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$QA_EMAIL\",\"code\":\"$code\",\"password\":\"$NEW_PASS\"}")
echo "$r4"
echo "$r4" | grep -q '"ok":true' || { echo "❌ FALLO reset-password"; exit 1; }

step "5/6 Login con la contraseña VIEJA (debe RECHAZAR con 401)"
http5=$(curl -s -o /tmp/oldpass.json -w '%{http_code}' -X POST "$BASE/login-challenge" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$OLD_PASS\"}")
echo "   HTTP $http5 · $(cat /tmp/oldpass.json)"
[ "$http5" = "401" ] && echo "   ✅ Correcto: la vieja ya NO vale" || { echo "❌ La contraseña vieja todavía funciona"; exit 1; }

step "6/6 Login con la contraseña NUEVA (debe ACEPTAR y mandar código de sesión)"
http6=$(curl -s -o /tmp/newpass.json -w '%{http_code}' -X POST "$BASE/login-challenge" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$NEW_PASS\"}")
echo "   HTTP $http6 · $(cat /tmp/newpass.json)"
echo "$http6" | grep -q '200' && echo "   ✅ La nueva contraseña SÍ funciona" || { echo "❌ La nueva contraseña fue rechazada"; exit 1; }

echo
echo "=========================================="
echo "🎉 RECUPERACIÓN 100% REAL VERIFICADA E2E"
echo "   registro → código por correo (SMTP real)"
echo "   → restablecimiento → login con la nueva"
echo "=========================================="
