#!/bin/bash
# Prueba E2E: login QA + POST a /api/devplay/buddy (verifica el cliente de IA unificado)
cd /home/z/my-project
BASE=http://localhost:3000
JAR=/tmp/qa-cookies.txt
rm -f "$JAR"

CSRF=$(curl -s -c "$JAR" $BASE/api/auth/csrf | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
LOGIN=$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w "%{http_code}" \
  -X POST $BASE/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=$CSRF&email=qa-check@devplay.test&password=qa123456")
echo "login status: $LOGIN"

echo "--- buddy test ---"
curl -s -b "$JAR" -X POST $BASE/api/devplay/buddy \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hola pixel, ¿quien te da vida?"}]}' | head -c 500
echo ""
echo "--- mailer demo test (forgot-password, sin SMTP = modo demo) ---"
curl -s -b "$JAR" -X POST $BASE/api/devplay/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"qa-check@devplay.test"}' | head -c 300
echo ""
rm -f "$JAR"
