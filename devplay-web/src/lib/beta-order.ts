/**
 * Orden editorial de juegos 🎮 (pedido del dueño de DevPlay):
 *   1º — los que tienen GIF entre sus capturas (mini-video: SIEMPRE de primeros)
 *   2º — los que tienen MÁS capturas
 *   desempate — más descargas
 *
 * Se usa en el Centro de Betas, el kiosco de Descubrir, la tira
 * "Descubrir juegos" del inicio y las cintas del hero.
 */
export function orderBetasByRichness<T>(
  posts: T[],
  getBeta: (p: T) => { screenshots?: string[] | null; downloads?: number } | null | undefined
): T[] {
  return posts
    .map((p) => {
      const beta = getBeta(p)
      const shots = Array.isArray(beta?.screenshots) ? (beta!.screenshots as string[]) : []
      const hasGif = shots.some((u) => typeof u === 'string' && u.toLowerCase().includes('.gif'))
      return { p, hasGif, shotsCount: shots.length, downloads: beta?.downloads ?? 0 }
    })
    .sort((a, b) => {
      if (a.hasGif !== b.hasGif) return a.hasGif ? -1 : 1
      if (b.shotsCount !== a.shotsCount) return b.shotsCount - a.shotsCount
      return b.downloads - a.downloads
    })
    .map((e) => e.p)
}

/** ¿Tiene alguna captura en GIF (mini-video)? */
export function betaHasGif(screenshots?: string[] | null): boolean {
  return (screenshots ?? []).some(
    (u) => typeof u === 'string' && u.toLowerCase().includes('.gif')
  )
}
