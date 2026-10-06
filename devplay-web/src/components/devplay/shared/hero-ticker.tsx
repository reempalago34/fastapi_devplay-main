'use client'

// ═══════════════════════════════════════════════════════════════
// CINTA DE TELETIPO del hero 🎞️ — estilo "marquee de cine" retro:
// etiqueta fija a la izquierda (★ EN DEVPLAY / ◆ LO MÁS JUGADO)
// y píldoras de juego pasando por debajo con degradado de salida.
// Textura de rayas diagonales para el toque de boleto antiguo.
// ⭐ LAS PÍLDORAS SON CLICABLES: llevan al detalle de la beta.
// Loop perfecto: el track contiene la MISMA secuencia 2x y la
// animación mueve translateX(0 → -50%). Pausa al hover (CSS).
// ═══════════════════════════════════════════════════════════════

import { Download, Gamepad2 } from 'lucide-react'

export interface TickerGame {
  id: string
  title: string
  version?: string | null
  genre?: string | null
  coverImage?: string | null
  downloads?: number
}

// Píldora de juego — cinta 1 (portada redonda + nombre + chip de versión). CLICABLE → detalle de la beta
function Pill({ games, onOpen }: { games: TickerGame[]; onOpen?: (id: string) => void }) {
  return (
    <>
      {games.map((g, i) => (
        <button
          key={`${g.id}-${i}`}
          type="button"
          title={`Ver ${g.title}`}
          onClick={(e) => { e.stopPropagation(); onOpen?.(g.id) }}
          className="inline-flex items-center gap-2.5 mx-2.5 whitespace-nowrap rounded-full bg-white/[0.08] border border-[#D9A441]/35 pl-1.5 pr-3.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] cursor-pointer hover:bg-white/[0.16] hover:border-[#D9A441]/70 hover:scale-[1.04] active:scale-[0.97] transition-transform"
        >
          {g.coverImage ? (
            <img
              src={g.coverImage}
              alt=""
              className="h-7 w-11 object-cover rounded-full ring-1 ring-[#D9A441]/50 shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
            />
          ) : (
            <span className="flex h-7 w-11 items-center justify-center rounded-full bg-[#D9A441]/20">
              <Gamepad2 className="h-3.5 w-3.5 text-[#D9A441]" />
            </span>
          )}
          <span className="font-bold text-[11px] tracking-wide text-[#F6EFDE]">{g.title}</span>
          {g.version && (
            <span className="rounded-full bg-[#D9A441]/25 border border-[#D9A441]/40 px-1.5 py-px text-[8.5px] font-bold text-[#F0D9A8]">
              v{g.version.replace(/^v/i, '')}
            </span>
          )}
        </button>
      ))}
    </>
  )
}

// Píldora de datos — cinta 2 (nombre + género + descargas)
function PillMeta({ games }: { games: TickerGame[] }) {
  return (
    <>
      {games.map((g, i) => (
        <span
          key={`${g.id}-m-${i}`}
          className="inline-flex items-center gap-2 mx-2.5 whitespace-nowrap rounded-full bg-black/[0.14] border border-white/15 px-3 py-1 text-[10px]"
        >
          <span className="font-bold tracking-wide text-[#FFF8EC]">{g.title}</span>
          {g.genre && (
            <span className="rounded-full bg-white/15 px-1.5 py-px text-[8.5px] font-semibold text-white/90">
              {g.genre}
            </span>
          )}
          {typeof g.downloads === 'number' && (
            <span className="inline-flex items-center gap-1 text-white/85">
              <Download className="h-2.5 w-2.5" />
              {g.downloads.toLocaleString('es')}
            </span>
          )}
        </span>
      ))}
    </>
  )
}

// Etiqueta fija a la izquierda — el contenido pasa por debajo del degradado
function Label({ text, from }: { text: string; from: string }) {
  return (
    <div
      className="absolute inset-y-0 left-0 z-10 flex items-center pl-3 pr-10 pointer-events-none"
      style={{ background: `linear-gradient(to right, ${from} 55%, transparent)` }}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D9A441] drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] whitespace-nowrap">
        {text}
      </span>
    </div>
  )
}

/* Contenido de reserva para cuando la API no devuelve ninguna beta todavía.
   Sin esto las cintas no se veían en local (la BD está vacía) y el bloque
   quedaba como un hueco raro bajo el hero. Estos son nombres y géneros
   plausibles: es decorado, no son datos reales de la base. */
const PLACEHOLDER_GAMES: TickerGame[] = [
  { id: 'ph-1', title: 'Neon Drift',        version: 'v0.4.2', genre: 'Racing',      downloads: 12840 },
  { id: 'ph-2', title: 'Pixel Farm',        version: 'v1.0.0', genre: 'Simulador',   downloads: 9320 },
  { id: 'ph-3', title: 'Void Walker',       version: 'v0.2.1', genre: 'Plataformas', downloads: 7615 },
  { id: 'ph-4', title: 'Café Píxel',       version: 'v0.9.0', genre: 'Gestión',     downloads: 6430 },
  { id: 'ph-5', title: 'Rogue Signal',      version: 'v0.3.5', genre: 'Roguelike',   downloads: 5120 },
  { id: 'ph-6', title: 'Arena de Codos',   version: 'v1.2.0', genre: 'Peleas',      downloads: 4388 },
  { id: 'ph-7', title: 'Deep Signal',       version: 'v0.6.1', genre: 'Exploración', downloads: 3902 },
  { id: 'ph-8', title: 'Turbo Manzana',     version: 'v0.1.9', genre: 'Arcade',      downloads: 2874 },
]

export function HeroTicker({
  games,
  onOpenGame,
  /** Usa los juegos de ejemplo cuando `games` viene vacío. */
  placeholder = true,
}: {
  games: TickerGame[]
  onOpenGame?: (id: string) => void
  placeholder?: boolean
}) {
  const real = games.filter((g) => g.title)
  // Sin juegos reales se muestran los de ejemplo para que la cinta siempre se
  // vea; si viene contenido de verdad, ese manda.
  const list = real.length > 0 ? real : placeholder ? PLACEHOLDER_GAMES : []
  if (list.length === 0) return null

  /* Cada mitad del track debe sobrepasar el ancho de pantalla: si hay pocos
     juegos repetimos la secuencia hasta tener ~8 items por mitad. */
  const reps = Math.max(1, Math.ceil(8 / list.length))
  const seq = Array.from({ length: reps }, () => list).flat()

  /* La velocidad se ajusta a cuántos píldoras hay. Con pocas, un ciclo largo
     se ve lento; con muchas, a velocidad fija iría demasiado rápido. El valor
     solo elige entre tres duraciones definidas en globals.css. */
  const speed = list.length <= 3 ? 'sm' : list.length <= 6 ? 'md' : 'lg'

  return (
    <div className="-mt-1 select-none">
      {/* Cinta 1 — píldoras con portada + nombre, CLICABLES (va hacia la izquierda) */}
      <div
        className="ticker-fade-parent relative overflow-hidden bg-[#40302A] border-y-2 border-[#D9A441]/60"
        style={{ color: '#40302A' }}
      >
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,rgba(217,164,65,0.05)_12px,rgba(217,164,65,0.05)_24px)] pointer-events-none" />
        {/* `ticker-track` mueve el contenido de derecha a izquierda. Al pasar
            el ratón se pausa (CSS) para poder leer o pulsar una píldora. */}
        <div className="ticker-track py-2 relative will-change-transform" data-count={speed}>
          <Pill games={seq} onOpen={onOpenGame} />
          <Pill games={seq} onOpen={onOpenGame} />
        </div>
        <Label text="★ En DevPlay" from="#40302A" />
      </div>
      {/* Cinta 2 — género + descargas (va hacia la derecha) */}
      <div
        className="ticker-fade-parent relative overflow-hidden bg-[#C05B2E] border-b-2 border-[#D9A441]/60"
        style={{ color: '#C05B2E' }}
      >
        <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_12px,rgba(64,48,42,0.08)_12px,rgba(64,48,42,0.08)_24px)] pointer-events-none" />
        <div className="ticker-track ticker-track-reverse py-1.5 relative will-change-transform" data-count={speed}>
          <PillMeta games={seq} />
          <PillMeta games={seq} />
        </div>
        <Label text="◆ Lo más jugado" from="#C05B2E" />
      </div>
    </div>
  )
}
