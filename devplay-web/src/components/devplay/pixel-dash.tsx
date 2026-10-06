'use client'

/**
 * ============================================================
 *  DEVPLAY — Pixel Dash 👾
 * ============================================================
 *  Minijuego endless runner en canvas.
 *
 *  El jugador corre solo hacia la derecha y solo controla el salto (hasta
 *  dos veces: doble salto). Se esquivan huecos y se recogen monedas.
 *
 *  Notas de implementación:
 *   - Bucle de `requestAnimationFrame` con delta de tiempo, para que la
 *     velocidad no dependa de los FPS: a 30Hz no tiene que ir el doble de
 *     rápido que a 60Hz.
 *   - El canvas mide 320x180 y se escala con CSS. Así los píxeles se ven
 *     grandes y cuadrados (pixel-art) sin depender de la resolución.
 *   - Colisión por cajas (AABB): la más simple que da el resultado justo
 *     para rectángulos contra rectángulos.
 *
 *  Para quitarlo: se borra este archivo y el import en `demo-game.tsx`.
 *  Nada más del proyecto depende de él.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------ Constantes */

/** Resolución interna del canvas. Todas las medidas van en estos píxeles. */
const W = 320
const H = 180
const GROUND_Y = 140

const GRAVITY = 900
const JUMP_V = -330
/** El segundo salto es más corto que el primero, a propósito. */
const DOUBLE_JUMP_V = -250

const RUN_SPEED = 132
const MAX_FALL = 620

const PLAYER_W = 12
const PLAYER_H = 16
/** Margen de gracia al morir: se cae un poco más allá del borde. */
const FALL_MARGIN = 24

/* ------------------------------------------------------------ Tipos */

interface Platform {
  x: number
  y: number
  w: number
  h: number
}

interface Coin {
  x: number
  y: number
  taken: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

type Phase = 'idle' | 'playing' | 'over'

interface GameState {
  phase: Phase
  /** Posición del jugador. `x` avanza solo; `y` cambia al saltar. */
  x: number
  y: number
  vy: number
  onGround: boolean
  /** Saltos que quedan en el aire. */
  jumpsLeft: number
  platforms: Platform[]
  coins: Coin[]
  particles: Particle[]
  score: number
  best: number
  /** Monedas recogidas en la partida actual. */
  coinsTaken: number
  /** Scroll del mundo. */
  camX: number
  /** Destello rojo al morir, de 1 a 0. */
  hurt: number
}

/* ------------------------------------------------------------ Generación */

/**
 * Terreno. NO es aleatorio: el patrón se repite con aritmética (i * 37) % 30,
 * etc. Un terreno aleatorio es imposible de saltar porque no se puede ver si
 * hay hueco hasta llegar. Con patrón fijo el jugador aprende la secuencia, que
 * es justo lo que hace un endless runner jugable.
 *
 * El mundo se genera largo de más (240 plataformas); a 132 px/s da para
 * varios minutos sin tener que regenerar nada.
 */
function buildTerrain(): { platforms: Platform[]; coins: Coin[] } {
  const platforms: Platform[] = [{ x: 0, y: GROUND_Y, w: 96, h: H - GROUND_Y }]
  const coins: Coin[] = []

  let x = 96
  /** Altura acumulada: sube un peldaño cada 4 plataformas y baja cada 8. */
  let step = 0

  for (let i = 0; i < 240; i++) {
    const gap = 40 + ((i * 37) % 30) // 40..69 px de hueco
    x += gap

    if (i % 8 === 7) step = 0
    else if (i % 4 === 0) step += 20
    const y = GROUND_Y - step

    const w = 44 + ((i * 53) % 46) // 44..89 px de plataforma
    platforms.push({ x, y, w, h: H - y })
    x += w

    /* Una moneda por cada dos plataformas, 18px por encima de la superficie.
       Nunca se pone moneda sobre un hueco: obligaría a saltar sin avisar. */
    if (i % 2 === 0) {
      coins.push({ x: p_center(platforms[platforms.length - 1]), y: y - 18, taken: false })
    }
  }

  return { platforms, coins }
}

const p_center = (p: Platform) => p.x + p.w / 2

function freshState(best: number): GameState {
  const { platforms, coins } = buildTerrain()
  return {
    phase: 'idle',
    x: 8,
    y: GROUND_Y - PLAYER_H,
    vy: 0,
    onGround: true,
    jumpsLeft: 2,
    platforms,
    coins,
    particles: [],
    score: 0,
    best,
    coinsTaken: 0,
    camX: 0,
    hurt: 0,
  }
}

/* ------------------------------------------------------------ Simulación */

/** Avanza la partida `dt` segundos. No dibuja: así se puede razonar aparte. */
function step(g: GameState, dt: number, jumpPressed: boolean) {
  if (g.phase !== 'playing') return

  /* Correr: siempre a la derecha. El jugador no frena. */
  g.x += RUN_SPEED * dt

  /* Salto. `jumpPressed` es un flanco (pulsación de este frame), no el estado
     de la tecla: si se usara el estado, se re-saltaría en cada frame. */
  if (jumpPressed) {
    if (g.onGround) {
      g.vy = JUMP_V
      g.onGround = false
      g.jumpsLeft = 1
    } else if (g.jumpsLeft > 0) {
      g.vy = DOUBLE_JUMP_V
      g.jumpsLeft -= 1
    }
  }

  g.vy += GRAVITY * dt
  if (g.vy > MAX_FALL) g.vy = MAX_FALL
  g.y += g.vy * dt

  /* Colisión. Las plataformas están ordenadas por x, así que en cuanto una
     queda a la derecha del jugador se puede parar el bucle. */
  g.onGround = false
  for (const p of g.platforms) {
    if (p.x > g.x) break

    const overlapsX = g.x + PLAYER_W > p.x && g.x < p.x + p.w
    if (!overlapsX) continue

    const bottom = g.y + PLAYER_H
    /* Solo aterriza si venía cayendo y el pie cruzó la superficie. */
    const crossed = bottom >= p.y && g.y <= p.y
    if (crossed && g.vy >= 0) {
      g.y = p.y - PLAYER_H
      g.vy = 0
      g.onGround = true
      g.jumpsLeft = 2
    }
  }

  /* Monedas: 8 puntos extra (además de los de distancia). */
  const cx = g.x + PLAYER_W / 2
  const cy = g.y + PLAYER_H / 2
  for (const c of g.coins) {
    if (c.taken) continue
    if (Math.abs(c.x - cx) > 14) continue
    if (Math.abs(c.y - cy) > 16) continue

    c.taken = true
    g.coinsTaken += 1
    g.score += 8
    for (let i = 0; i < 5; i++) {
      g.particles.push({
        x: c.x,
        y: c.y,
        vx: (Math.random() - 0.5) * 90,
        vy: -50 - Math.random() * 70,
        life: 0.35,
      })
    }
  }

  /* Partículas de tipo chispas. */
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 420 * dt
    p.life -= dt
    if (p.life <= 0) g.particles.splice(i, 1)
  }

  /* Puntos por distancia. */
  g.score += Math.floor(RUN_SPEED * dt) / 10

  /* Cámara: deja al jugador en el tercio izquierdo. */
  g.camX = g.x - 60

  /* ¿Caído? */
  if (g.y > H + FALL_MARGIN) {
    g.phase = 'over'
    if (g.score > g.best) g.best = g.score
  }
}

/* ------------------------------------------------------------ Dibujo */

function draw(g: GameState, ctx: CanvasRenderingContext2D) {
  /* Se redondea la cámara: con decimales, las plataformas tiemblan. */
  const camX = Math.floor(g.camX)

  ctx.clearRect(0, 0, W, H)

  /* Cielo con degradado. */
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#1a1430')
  sky.addColorStop(1, '#2d1f3d')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  /* Estrellas: posiciones fijas moduladas por la cámara, así hay parallax y
     no parpadean. */
  for (let i = 0; i < 44; i++) {
    const span = W + 40
    const sx = (((i * 61 - camX * 0.25) % span) + span) % span
    const sy = ((i * 37) % 74) + 6
    const big = i % 5 === 0
    ctx.fillStyle = big ? '#8b7fa8' : '#5a4a72'
    ctx.fillRect(Math.floor(sx), sy, big ? 2 : 1, big ? 2 : 1)
  }

  /* Plataformas. */
  for (const p of g.platforms) {
    const px = Math.floor(p.x - camX)
    if (px > W || px + p.w < 0) continue

    ctx.fillStyle = '#3d2b52'
    ctx.fillRect(px, p.y, p.w, p.h)
    /* Borde superior: es la superficie que se pisa, va más claro. */
    ctx.fillStyle = '#D9A441'
    ctx.fillRect(px, p.y, p.w, 3)
    /* Textura de ladrillo, solo decorativa. */
    ctx.fillStyle = '#2a1d3a'
    for (let bx = px + 7; bx < px + p.w - 2; bx += 12) {
      ctx.fillRect(bx, p.y + 8, 6, 2)
    }
  }

  /* Monedas. */
  for (const c of g.coins) {
    if (c.taken) continue
    const cx = Math.floor(c.x - camX)
    if (cx < -12 || cx > W + 12) continue
    ctx.fillStyle = '#F0C674'
    ctx.fillRect(cx - 4, c.y - 4, 8, 8)
    ctx.fillStyle = '#C05B2E'
    ctx.fillRect(cx - 1, c.y - 1, 2, 2)
  }

  /* Chispas. */
  ctx.fillStyle = '#8b7fa8'
  for (const p of g.particles) {
    ctx.fillRect(Math.floor(p.x - camX), Math.floor(p.y), 2, 2)
  }

  /* Jugador. */
  const px = 8
  ctx.fillStyle = '#8B5CF6'
  ctx.fillRect(px, Math.floor(g.y), PLAYER_W, PLAYER_H)
  ctx.fillStyle = '#C4B5FD'
  ctx.fillRect(px, Math.floor(g.y), PLAYER_W, 4)
  ctx.fillStyle = '#1a1430'
  ctx.fillRect(px + 3, Math.floor(g.y) + 7, 2, 2)
  ctx.fillRect(px + 7, Math.floor(g.y) + 7, 2, 2)

  /* Destello rojo al morir. */
  if (g.hurt > 0) {
    ctx.fillStyle = `rgba(220, 38, 38, ${g.hurt * 0.45})`
    ctx.fillRect(0, 0, W, H)
  }
}

/* ------------------------------------------------------------ Componente */

const JUMP_KEYS = new Set(['ArrowUp', 'w', 'W', ' ', 'ArrowDown'])

export function PixelDash({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<GameState | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef(0)
  /* Pulsación de salto pendiente de consumir. Es un ref porque llega del
     teclado a 60fps y no debe provocar renders. */
  const jumpRef = useRef(false)
  /** Fase y marcadores: esto sí se pinta, pero cambia pocas veces. */
  const [phase, setPhase] = useState<Phase>('idle')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [coins, setCoins] = useState(0)

  const start = useCallback(() => {
    const prevBest = gameRef.current?.best ?? 0
    gameRef.current = freshState(prevBest)
    gameRef.current.phase = 'playing'
    jumpRef.current = false
    setPhase('playing')
    setScore(0)
    setCoins(0)
  }, [])

  /* Estado inicial (sin empezar). */
  useEffect(() => {
    if (!gameRef.current) gameRef.current = freshState(0)
  }, [])

  /* Teclado: escucha en window porque el canvas no es focusable y así no hace
     falta hacer clic antes. */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (JUMP_KEYS.has(e.key)) {
        e.preventDefault()
        /* Si está parado, el primer toque ya arranca la partida. */
        const g = gameRef.current
        if (g && g.phase !== 'playing') {
          start()
          jumpRef.current = true
        } else {
          jumpRef.current = true
        }
      } else if (e.key === 'r' || e.key === 'R') {
        start()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [start])

  /* Bucle principal. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    /* Sin suavizado: es lo que mantiene los píxeles cuadrados al escalar. */
    ctx.imageSmoothingEnabled = false

    const loop = (ts: number) => {
      /* Techo de 50ms: si la pestaña estuvo en segundo plano, el dt gigante
         que vuelve al forefront no debe teletransportar al jugador a través
         de las plataformas. */
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000) || 0
      lastTsRef.current = ts

      const g = gameRef.current
      if (g) {
        step(g, dt, jumpRef.current)
        /* La pulsación se consume: si no, saltaría en cada frame. */
        jumpRef.current = false

        if (g.phase === 'over' && phase !== 'over') {
          setPhase('over')
          setBest(g.best)
          setScore(Math.floor(g.score))
        }
        /* El marcador solo se actualiza si cambió de entero: evita renders
           en cada frame. */
        const shown = Math.floor(g.score)
        if (shown !== score) setScore(shown)

        if (g.hurt > 0) {
          g.hurt = Math.max(0, g.hurt - dt * 1.6)
        }
        draw(g, ctx)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [phase, score])

  /* Marca el destello rojo cuando acaba de morir. */
  const prevPhase = useRef(phase)
  useEffect(() => {
    const g = gameRef.current
    if (prevPhase.current === 'playing' && phase === 'over' && g) g.hurt = 1
    prevPhase.current = phase
  }, [phase])

  /* Toque / clic: salta. Si está parado, arranca. */
  const tap = () => {
    const g = gameRef.current
    if (!g) return
    if (g.phase !== 'playing') {
      start()
      return
    }
    jumpRef.current = true
  }

  return (
    <div className={cn('glass-card overflow-hidden', className)}>
      <div className="relative bg-[#1a1430]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={tap}
          className="block w-full"
          style={{ aspectRatio: `${W} / ${H}`, touchAction: 'manipulation' }}
          role="img"
          aria-label="Pixel Dash: minijuego de plataformas. Pulsa espacio para saltar y R para reiniciar."
        />

        {/* Portada mientras no se juega. */}
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1a1430]/88 px-4 text-center">
            <p className="label-caps text-[#D9A441]">Pixel Dash</p>
            {phase === 'idle' ? (
              <>
                <p className="text-sm font-semibold text-[#F6EFDE]">
                  Corre solo. Tú solo saltas.
                </p>
                <p className="text-[11px] leading-relaxed text-[#F6EFDE]/60">
                  Espacio / ↑ / W / clic para saltar
                  <br />
                  Doble salto disponible · R reinicia
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-3xl font-bold text-[#F6EFDE]">
                  {score} pts
                </p>
                <p className="text-[11px] text-[#F6EFDE]/70">
                  Mejor {best} · monedas {coins}
                </p>
              </>
            )}
            <Button className="btn-gradient-primary rounded-sm" onClick={start}>
              {phase === 'idle' ? 'Jugar' : 'Otra vez'}
            </Button>
          </div>
        )}

        {/* Marcador mientras se juega. `pointer-events-none` para que no
            robe el clic que hace saltar. */}
        {phase === 'playing' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-2 py-1.5 font-mono text-[11px] font-bold text-[#F6EFDE]">
            <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.9)]">{score}</span>
            <span className="text-[#F0C674] drop-shadow-[0_1px_0_rgba(0,0,0,0.9)]">
              x{coins}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default PixelDash