#!/bin/bash
# Prueba E2E de los 3 flujos de correo/códigos en modo demo
BASE=http://localhost:3000
JAR=/tmp/qa2-cookies.txt
rm -f "$JAR"

echo "===== 1. RECUPERACIÓN DE CONTRASEÑA (flujo completo) ====="
# a) pedir enlace
RESP=$(curl -s -X POST $BASE/api/devplay/auth/forgot-password -H "Content-Type: application/json" -d '{"email":"qa-check@devplay.test"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('demoToken',''))")
echo "a) enlace pedido → token: ${TOKEN:0:16}..."

# b) restablecer con el token
RESET=$(curl -s -X POST $BASE/api/devplay/auth/reset-password -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"password\":\"qa654321\"}")
echo "b) reset con token → $RESET"

# c) login con la NUEVA contraseña
CSRF=$(curl -s -c "$JAR" $BASE/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
LOGIN=$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=$CSRF&email=qa-check@devplay.test&password=qa654321")
SESSION=$(curl -s -b "$JAR" $BASE/api/auth/session | python3 -c "import sys,json;d=json.load(sys.stdin);print('OK' if d.get('user') else 'FALLO')")
echo "c) login con nueva contraseña → http=$LOGIN sesión=$SESSION"
rm -f "$JAR"

echo ""
echo "===== 2. CÓDIGOS DE ELIMINACIÓN (flujo completo con cuenta desechable) ====="
# a) crear cuenta desechable
REG=$(curl -s -X POST $BASE/api/devplay/auth/register -H "Content-Type: application/json" \
  -d '{"email":"mail-flow@test.com","username":"MailFlow","password":"prueba123"}')
UID=$(echo "$REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
echo "a) cuenta desechable creada: $UID"

# b) login con ella
JAR2=/tmp/mf-cookies.txt; rm -f "$JAR2"
CSRF2=$(curl -s -c "$JAR2" $BASE/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
curl -s -b "$JAR2" -c "$JAR2" -o /dev/null -X POST $BASE/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=$CSRF2&email=mail-flow@test.com&password=prueba123"

# c) pedir código
CODE_RES=$(curl -s -b "$JAR2" -X POST $BASE/api/devplay/security/account -H "Content-Type: application/json" -d '{"action":"request-code"}')
CODE=$(echo "$CODE_RES" | python3 -c "import sys,json;print(json.load(sys.stdin).get('devCode',''))")
echo "b) código pedido → $CODE_RES" | head -c 200; echo ""

# d) verificar código
VERIFY=$(curl -s -b "$JAR2" -X POST $BASE/api/devplay/security/account -H "Content-Type: application/json" \
  -d "{\"action\":\"verify-code\",\"code\":\"$CODE\"}")
echo "c) verificar código → $VERIFY"

# e) código incorrecto debe fallar
BAD=$(curl -s -b "$JAR2" -X POST $BASE/api/devplay/security/account -H "Content-Type: application/json" \
  -d '{"action":"verify-code","code":"000000"}')
echo "d) código incorrecto → $BAD"

# f) confirmar eliminación
CONF=$(curl -s -b "$JAR2" -X POST $BASE/api/devplay/security/account -H "Content-Type: application/json" \
  -d "{\"action\":\"confirm\",\"code\":\"$CODE\",\"password\":\"prueba123\",\"confirm\":\"ELIMINAR MI CUENTA\"}")
echo "e) confirmar eliminación → $CONF"
rm -f "$JAR2"

echo ""
echo "===== 3. REGISTRO (correo de bienvenida, no bloqueante) ====="
REG2=$(curl -s -X POST $BASE/api/devplay/auth/register -H "Content-Type: application/json" \
  -d '{"email":"welcome-test@test.com","username":"WelcomeTest","password":"prueba123"}')
echo "registro → $(echo $REG2 | head -c 120)"
