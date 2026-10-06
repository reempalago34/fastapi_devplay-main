/**
 * DevPlay Mailer 📬 — OBSOLETO.
 *
 * Antes el frontend enviaba los correos (codigos de verificacion, recuperacion
 * de contrasena) por SMTP desde el navegador. Ahora los envia la API de FastAPI
 * (`app/services/`), que es la unica que tiene acceso al servidor de correo.
 * Ningun modulo lo importa: se deja el archivo solo como referencia y se puede
 * borrar sin mas. Por eso se excluye del typecheck.
 *
 * @ts-nocheck
 */

/* eslint-disable */
/*
import nodemailer from 'nodemailer'
*/
