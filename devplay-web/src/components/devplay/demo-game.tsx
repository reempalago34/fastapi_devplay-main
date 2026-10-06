'use client'

/**
 * Tarjeta de demostración del minijuego Pixel Dash.
 *
 * Existe para que el juego se vea sin tener que entrar a otra vista: va en el
 * "Acerca de" y también se puede montar en cualquier otra parte.
 *
 * Para quitar el juego: borrar `pixel-dash.tsx` y este archivo, y quitar el
 * `<PixelDashDemo />` donde se use. No hay nada más atado a él.
 */

import { PixelDash } from './pixel-dash'

export function PixelDashDemo({ className }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="pixeldash-title">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="pixeldash-title" className="text-section">
          Pixel Dash 👾
        </h2>
        <span className="label-caps text-muted-foreground">demo</span>
      </header>

      <PixelDash />

      <p className="mt-2 text-xs text-muted-foreground">
        Minijuego hecho con canvas y sin dependencias. Pulsa{' '}
        <kbd className="rounded-sm border px-1 font-mono">espacio</kbd> para
        saltar, dos veces para el doble salto, y{' '}
        <kbd className="rounded-sm border px-1 font-mono">R</kbd> para empezar de
        cero. También funciona con el dedo en móvil.
      </p>
    </section>
  )
}

export default PixelDashDemo