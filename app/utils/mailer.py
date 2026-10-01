"""Envío de correos por SMTP + plantillas retro de DevPlay 📬

Port de devplay-main/src/lib/mailer.ts. Sin SMTP configurado, `send_mail`
devuelve False (modo demo): el código queda en el log y la API lo devuelve
como `demoCode` para poder probar el flujo completo.
"""

import logging
import re
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("devplay.mail")

# Paleta retro Terracota & Crema de devplay-main
CREAM = "#FBF3E4"
INK = "#4A2E21"
TERRA = "#C66E41"
TERRA_DARK = "#A9552F"
OLIVE = "#7A8B4C"


def mail_enabled() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_pass)


def send_mail(to: str, subject: str, html: str, text: str | None = None) -> bool:
    """Envía un correo. False si no hay SMTP o falla el envío (no lanza)."""
    settings = get_settings()
    if not mail_enabled():
        logger.info(
            "[mailer·demo] SMTP no configurado. Correo NO enviado a %s — asunto: %r",
            to,
            subject,
        )
        return False

    message = EmailMessage()
    message["From"] = settings.mail_from or f"DevPlay <{settings.smtp_user}>"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text or _strip_html(html))

    context = ssl.create_default_context()
    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, timeout=15, context=context
            ) as smtp:
                smtp.login(settings.smtp_user, settings.smtp_pass)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.ehlo()
                smtp.login(settings.smtp_user, settings.smtp_pass)
                smtp.send_message(message)
    except Exception:
        logger.exception("[mailer] Error enviando correo a %s", to)
        return False

    logger.info("[mailer] Correo enviado a %s — %r", to, subject)
    return True


def _strip_html(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


# ------------------------------- Plantillas --------------------------------


def _shell(title: str, body_html: str, footer_note: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#EFE3CC;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3CC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr>
            <td style="text-align:center;padding:8px 0 18px 0;">
              <span style="display:inline-block;background:{TERRA};color:{CREAM};font-size:22px;font-weight:bold;letter-spacing:2px;padding:10px 26px;border-radius:10px;border:3px solid {INK};">
                🤖 DevPlay
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:{CREAM};border:3px solid {INK};border-radius:14px;padding:32px 30px;box-shadow:4px 4px 0 rgba(74,46,33,0.25);">
              <h1 style="margin:0 0 6px 0;color:{INK};font-size:22px;">{title}</h1>
              <div style="height:3px;background:repeating-linear-gradient(90deg,{TERRA} 0 10px,transparent 10px 16px);margin:14px 0 18px 0;border-radius:2px;"></div>
              {body_html}
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding:16px 10px 0 10px;color:#8A7357;font-size:12px;line-height:1.6;">
              {footer_note}
              <br/>© DevPlay — la plaza retro de los devs indie 🎮
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _big_code(code: str) -> str:
    return f"""
  <p style="margin:0 0 14px 0;color:{INK};font-size:15px;line-height:1.6;">Tu código es:</p>
  <div style="text-align:center;margin:0 0 18px 0;">
    <span style="display:inline-block;background:#FFF9EE;border:3px dashed {TERRA};color:{TERRA_DARK};font-size:34px;font-weight:bold;letter-spacing:10px;padding:14px 26px;border-radius:12px;font-family:'Courier New',monospace;">
      {code}
    </span>
  </div>
  <p style="margin:0;color:{INK};font-size:13px;line-height:1.6;">⏳ Caduca en <b>10 minutos</b>. Si no fuiste tú, ignora este correo y cambia tu contraseña por si acaso.</p>"""


def verification_code_email(username: str, code: str, purpose: str) -> tuple[str, str]:
    """Devuelve (asunto, html) para un código de 6 dígitos."""
    subject = "Tu código de verificación · DevPlay ✉️"
    html = _shell(
        f"¡Hola, {username}!",
        f'<p style="margin:0 0 14px 0;color:{INK};font-size:15px;line-height:1.7;">'
        f"Usá este código para <b>{purpose}</b>:</p>" + _big_code(code),
        "Nunca te pediremos este código por chat ni por llamada."
        " Solo se ingresa dentro de DevPlay.",
    )
    return subject, html


def welcome_email(username: str) -> tuple[str, str]:
    subject = "¡Bienvenido a DevPlay! 🎮🤖"
    html = _shell(
        f"¡Llegaste, {username}! 🎉",
        f'<p style="margin:0 0 12px 0;color:{INK};font-size:15px;line-height:1.7;">'
        "Ya eres parte de la plaza retro donde la comunidad indie publica sus"
        " juegos, betas, videos y devlogs.</p>"
        f'<ul style="margin:0 0 14px 0;padding-left:20px;color:{INK};font-size:14px;line-height:1.9;">'
        "<li>🎮 Sube tu beta y que la comunidad te dé feedback</li>"
        "<li>💬 Saludita en el Chat Mundial</li>"
        "<li>🤖 Pregúntale lo que quieras a Pixel, el asistente de la esquina</li>"
        f"</ul><p style=\"margin:0;color:{OLIVE};font-size:14px;line-height:1.6;\">"
        "Ahora sí... ¡a crear! ☕✨</p>",
        "Recibes este correo porque creaste una cuenta en DevPlay.",
    )
    return subject, html
