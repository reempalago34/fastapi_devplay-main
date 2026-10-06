'use client'

import { useEffect, useRef } from 'react'
import { Megaphone } from 'lucide-react'
import { adsEnabled, ADSENSE_CLIENT, ADSENSE_SLOT_FEED, SPONSOR_HOUSE_ADS, type HouseAd } from '@/lib/ads'
import { pickHouseAd } from './ad-utils'

/**
 * AdSlot 📢 — espacio de publicidad con el estilo retro de DevPlay.
 *
 * - Con AdSense configurado → renderiza el bloque <ins> de Google.
 * - Con patrocinadores propios (SPONSOR_HOUSE_ADS) → muestra su tarjeta.
 * - Sin nada de eso → NO renderiza nada (el dueño pidió quitar el
 *   placeholder "Tu anuncio aquí").
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export function AdSlot({ slot, className }: { slot?: string; className?: string }) {
  const pushed = useRef(false)

  // Registrar el bloque ante AdSense (una vez por slot)
  useEffect(() => {
    if (!adsEnabled || pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* AdSense aún no cargó: lo ignora silenciosamente */
    }
  }, [])

  const house = pickHouseAd(SPONSOR_HOUSE_ADS)

  /* Sin AdSense y sin patrocinadores no se pinta nada. El `house &&` delante de
     la rama del patrocinador es lo que permite a TypeScript saber que `house`
     no es null dentro de ese bloque. */
  if (!adsEnabled && !house) return null

  return (
    <div className={`glass-card frame-double relative overflow-hidden ${className ?? ''}`} aria-label="Espacio publicitario">
      {/* Sello esquina */}
      <span className="absolute top-0 right-0 z-10 flex items-center gap-1 label-caps !text-[7px] !tracking-[0.18em] bg-secondary/80 text-muted-foreground px-2 py-1 rounded-bl-sm">
        <Megaphone className="h-2.5 w-2.5" />
        Publicidad
      </span>

      {adsEnabled ? (
        /* ===== Publicidad real de Google AdSense ===== */
        <ins
          className="adsbygoogle block"
          style={{ display: 'block', minHeight: 120 }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot || ADSENSE_SLOT_FEED}
          data-full-width-responsive="true"
        />
      ) : (
        /* ===== Patrocinador de la casa ===== */
        house && (
          <a href={house.href} target="_blank" rel="noopener sponsored" className="block group">
            <div className="flex items-center gap-3.5 px-4 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm frame-double bg-secondary text-2xl group-hover:scale-105 transition-transform">
                {house.emoji}
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-foreground leading-tight">{house.title}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{house.description}</p>
                <span className="label-caps !text-[8px] text-primary mt-1.5 inline-block group-hover:underline">
                  {house.cta} →
                </span>
              </div>
            </div>
          </a>
        )
      )}
    </div>
  )
}
