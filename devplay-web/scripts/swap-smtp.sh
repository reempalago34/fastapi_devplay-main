#!/bin/bash
# ============================================================
# Cambia el remitente de los correos de DevPlay 📬
# Uso: bash swap-smtp.sh <correo-nuevo@gmail.com>
# Reemplaza SMTP_USER, SMTP_PASS y MAIL_FROM en .env,
# respalda el .env anterior, reinicia y manda correo de prueba.
# ============================================================
set -euo pipefail

NEW_EMAIL="${1:-}"
NEW_PASS="ujgdqyvhucbvwagl"
ENV_FILE="/home/z/my-project/.env"

if [ -z "$NEW_EMAIL" ]; then
  echo "❌ Falta el correo: bash swap-smtp.sh <correo-nuevo@gmail.com>"
  exit 1
fi

echo "==> Respaldo del .env actual"
cp "$ENV_FILE" "/home/z/my-project/.env.backup-frank-$(date +%s)"

echo "==> Actualizando credenciales SMTP → $NEW_EMAIL"
sed -i "s|^SMTP_USER=.*|SMTP_USER=$NEW_EMAIL|" "$ENV_FILE"
sed -i "s|^SMTP_PASS=.*|SMTP_PASS=$NEW_PASS|" "$ENV_FILE"
sed -i "s|^MAIL_FROM=.*|MAIL_FROM=\"DevPlay <$NEW_EMAIL>\"|" "$ENV_FILE"
grep -E "^(SMTP_USER|SMTP_PORT|MAIL_FROM)" "$ENV_FILE" | sed 's/^SMTP_PASS=.*/SMTP_PASS=***/'

echo "==> Reiniciando DevPlay"
bash /home/z/my-project/scripts/restart-devplay.sh > /tmp/restart.log 2>&1
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s http://localhost:3000/api/health --max-time 5 2>/dev/null | grep -q '"ok":true'; then
    echo "   ✅ Servidor arriba"
    break
  fi
  sleep 7
done

echo "==> Enviando correo de prueba real a $NEW_EMAIL"
cd /home/z/my-project && node scripts/test-mail.mjs "$NEW_EMAIL" || bun scripts/test-mail.mjs "$NEW_EMAIL"
