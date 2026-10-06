import type { HouseAd } from '@/lib/ads'

/** Elige un anuncio de la casa al azar (o null si no hay). */
export function pickHouseAd(ads: HouseAd[]): HouseAd | null {
  if (!ads || ads.length === 0) return null
  return ads[Math.floor(Math.random() * ads.length)]
}
