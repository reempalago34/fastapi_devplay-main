# Conexiones de DevPlay 🔌

Guía rápida para dejar conectadas las dos cosas que piden claves:
el **cerebro de Pixel** (Z.ai) y el **envío de correos** (Google/Gmail).

> Después de cambiar `.env`, reinicia el servidor para que lea los valores nuevos.

---

## 1. Cerebro de Pixel 🧠 (clave API de Z.ai)

Pixel ya funciona dentro de este entorno de desarrollo (usa la conexión interna
que trae el sandbox). La clave propia se necesita cuando montes la web fuera de
aquí (tu servidor, Vercel, Coolify, etc.).

### Conseguir la clave (gratis)

1. Entra a **https://z.ai/manage-apikey/apikey-list** y crea una cuenta.
2. Ve a **API Keys** → **Create API Key**.
3. Copia la clave (empieza por algo como `sk-...`).
4. En el modelo, no tienes que pagar nada: **glm-4.5-flash es el modelo gratuito**,
   y va de sobra para una comunidad como DevPlay.

### Conectarla

Abre `.env` (en la raíz del proyecto) y añade:

```env
ZAI_API_KEY=tu_clave_aqui
ZAI_MODEL=glm-4.5-flash
```

Reinicia el servidor. Listo — el código ya está preparado
(`src/lib/ai.ts`): si ve `ZAI_API_KEY`, usa tu clave automáticamente;
si no, usa la del entorno de desarrollo.

### Probar que quedó conectada

Habla con Pixel: si responde normal, está vivo. Si la clave estuviera mal,
Pixel diría "No pude pensar la respuesta ahora mismo" y en el log del servidor
verás el error exacto (`[buddy] error: Z.ai API 401...`).

---

## 2. Correos con Google 📬 (Gmail SMTP)

Sirve para los tres correos que DevPlay manda:
**recuperación de contraseña**, **códigos de seguridad** (eliminar cuenta)
y **bienvenida** a nuevos devs.

### Crear la "Contraseña de aplicación" de Google

Google ya no deja entrar con tu contraseña normal a programas externos,
por eso se crea una clave especial de 16 letras:

1. Entra a **https://myaccount.google.com** con el correo que quieres que envíe
   los mensajes (ej. `devplay.oficial@gmail.com`).
2. **Seguridad** → activa la **Verificación en 2 pasos**
   (es obligatoria; sin esto no aparecen las contraseñas de aplicación).
3. Ve directo a **https://myaccount.google.com/apppasswords**
4. Nombre de la app: `DevPlay` → **Crear**.
5. Google te muestra 16 letras (ej. `abcd abcd abcd abcd`). Cópialas.

### Conectarla

Abre `.env` y añade (las 16 letras SIN espacios):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=abcdabcdabcdabcd
MAIL_FROM="DevPlay <tucorreo@gmail.com>"
```

Reinicia el servidor.

### Probar que quedó conectada

1. En la web: **olvidé mi contraseña** → escribe tu correo → revisa tu bandeja
   (y la carpeta de spam la primera vez).
2. También puedes mirar el log del servidor: si envía bien verás
   `[mailer] Correo enviado a ...`; si falla verás el error de Gmail.

### Datos útiles

- **Límite de Gmail**: ~500 correos/día. Para una comunidad de hasta 1k personas
  va bien al inicio; si algún día te quedas corto, Supabase ofrece SMTP propio
  (Settings → Auth → SMTP) o servicios como Resend tienen plan gratis.
- Si cambias el correo de envío, actualiza también `MAIL_FROM`.
- Sin SMTP configurado, la web NO se rompe: los enlaces y códigos aparecen en
  modo demo en la propia pantalla/log (útil para probar sin enviar nada).

---

## Chuleta final 📝

```env
# Cerebro de Pixel
ZAI_API_KEY=tu_clave_de_z.ai
ZAI_MODEL=glm-4.5-flash

# Correos por Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=las16letras
MAIL_FROM="DevPlay <tucorreo@gmail.com>"

# URL pública (para que los enlaces del correo apunten a tu dominio)
NEXTAUTH_URL=https://tudominio.com
```
