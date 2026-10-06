/**
 * Configuración de anuncios de DevPlay 📢
 *
 * HOY (sin cuenta de AdSense): los espacios muestran una tarjeta bonita de
 * "Tu anuncio aquí" — sirve también para vender espacios manualmente
 * (le pones la imagen/enlace del patrocinador en SPONSOR_HOUSE_ADS).
 *
 * MAÑANA (con AdSense): agrega en .env
 *   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
 *   NEXT_PUBLIC_ADSENSE_SLOT_FEED=1234567890
 * y los espacios renderizan publicidad real de Google automáticamente.
 */

export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''
export const ADSENSE_SLOT_FEED = process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED || ''

export const adsEnabled = Boolean(ADSENSE_CLIENT)

/** Anuncios "de la casa": patrocinadores que vendemos nosotros mismos. */
export interface HouseAd {
  title: string
  description: string
  cta: string
  href: string
  emoji: string
}

/** Deja vacío [] para mostrar el placeholder genérico de "Tu anuncio aquí". */
export const SPONSOR_HOUSE_ADS: HouseAd[] = []

/** Cada cuántos posts del feed aparece un espacio de anuncio. */
export const AD_EVERY_POSTS = 6
