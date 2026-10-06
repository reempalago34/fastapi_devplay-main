'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Gamepad2, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/lib/stores'

// Pre-compute particle configuration once (stable across renders).
// Driven purely by CSS keyframes — no JS animation loops.
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${(i * 53) % 100}%`,
  top: `${(i * 37 + 5) % 100}%`,
  size: 4 + (i % 4) * 3,
  delay: `${((i * 0.37) % 3).toFixed(2)}s`,
  duration: `${(7 + (i % 5) * 1.5).toFixed(1)}s`,
}))

export default function NotFound() {
  const setView = useUIStore((s) => s.setView)
  const reduceMotion = useReducedMotion()

  const handleGoHome = () => {
    // Update SPA view state (in case the user was already on "/")
    setView('explore')
    // Navegación DURA a "/": a diferencia de router.push(), una carga
    // completa siempre funciona — incluso si el router quedó en mal estado
    // o la página se abrió directamente en una URL rota.
    window.location.assign('/')
  }

  const handleGoBack = () => {
    // Historial del navegador con red de seguridad: si no hay dónde volver,
    // nos lleva al inicio en vez de no hacer nada.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      window.location.assign('/')
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* ============================================================
          Component-scoped keyframes (CRT scanlines + pixel float +
          chromatic-aberration glitch). Defined here so the page is
          self-contained and respects prefers-reduced-motion.
         ============================================================ */}
      <style>{`
        @keyframes dp-pixel-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.18; }
          50%      { transform: translate3d(6px, -14px, 0) scale(1.25); opacity: 0.45; }
        }
        @keyframes dp-glitch-r {
          0%, 90%, 100% { transform: translate(-2px, 0);   clip-path: inset(0 0 0 0); }
          92%           { transform: translate(-5px, -2px); clip-path: inset(20% 0 40% 0); }
          94%           { transform: translate(-1px, 1px);  clip-path: inset(70% 0 10% 0); }
          96%           { transform: translate(-4px, 0);    clip-path: inset(10% 0 80% 0); }
        }
        @keyframes dp-glitch-c {
          0%, 90%, 100% { transform: translate(2px, 0);   clip-path: inset(0 0 0 0); }
          92%           { transform: translate(5px, 2px); clip-path: inset(40% 0 20% 0); }
          94%           { transform: translate(1px, -1px); clip-path: inset(10% 0 70% 0); }
          96%           { transform: translate(4px, 0);   clip-path: inset(80% 0 10% 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dp-glitch-layer { animation: none !important; transform: none !important; }
          .dp-pixel        { animation: none !important; opacity: 0.22 !important; }
        }
        .dp-scanlines {
          background-image: repeating-linear-gradient(
            0deg,
            transparent 0,
            transparent 2px,
            currentColor 2px,
            currentColor 3px
          );
        }
      `}</style>

      {/* CRT scanlines overlay */}
      <div
        aria-hidden
        className="dp-scanlines pointer-events-none absolute inset-0 z-30 opacity-[0.06] text-foreground mix-blend-overlay"
      />

      {/* Background gradient glows (themed) */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div
          className="absolute left-1/2 top-1/3 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklch, var(--primary) 40%, transparent), transparent 70%)',
          }}
        />
        <div
          className="absolute right-[8%] top-[12%] h-40 w-40 rounded-full opacity-25 blur-2xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklch, var(--accent) 70%, transparent), transparent 70%)',
          }}
        />
        <div
          className="absolute left-[8%] bottom-[15%] h-32 w-32 rounded-full opacity-20 blur-2xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklch, var(--primary) 60%, transparent), transparent 70%)',
          }}
        />
      </div>

      {/* Floating pixel particles (CSS-driven) */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="dp-pixel absolute block rounded-[2px]"
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: 'color-mix(in oklch, var(--primary) 75%, transparent)',
              animation: reduceMotion
                ? 'none'
                : `dp-pixel-float ${p.duration} ease-in-out ${p.delay} infinite`,
              opacity: 0.25,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
          {/* Floating / rotating Gamepad2 icon */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <motion.div
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: [0, -8, 0],
                      rotate: [-4, 4, -4],
                    }
              }
              transition={{
                duration: 4.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative grid place-items-center"
            >
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-60"
                style={{
                  background:
                    'color-mix(in oklch, var(--primary) 45%, transparent)',
                }}
              />
              <div className="relative grid place-items-center h-20 w-20 sm:h-24 sm:w-24 rounded-lg glass-card">
                <Gamepad2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
              </div>
            </motion.div>
          </motion.div>

          {/* Glitch "404" with chromatic aberration (RGB split) */}
          <div
            className="relative mb-4 leading-none isolate"
            aria-label="Error 404"
          >
            {/* Red/coral chromatic aberration layer */}
            <span
              aria-hidden
              className="dp-glitch-layer pointer-events-none absolute inset-0 font-mono font-black tracking-tighter text-[6.5rem] sm:text-[10rem] md:text-[13rem] select-none mix-blend-screen"
              style={{
                color: 'oklch(0.65 0.22 25)',
                animation: reduceMotion
                  ? 'none'
                  : 'dp-glitch-r 2.8s infinite steps(1, end)',
              }}
            >
              404
            </span>
            {/* Mint/teal chromatic aberration layer */}
            <span
              aria-hidden
              className="dp-glitch-layer pointer-events-none absolute inset-0 font-mono font-black tracking-tighter text-[6.5rem] sm:text-[10rem] md:text-[13rem] select-none mix-blend-screen"
              style={{
                color: 'oklch(0.7 0.18 160)',
                animation: reduceMotion
                  ? 'none'
                  : 'dp-glitch-c 2.8s infinite steps(1, end)',
              }}
            >
              404
            </span>
            {/* Main "404" with skew/glitch animation via Framer Motion */}
            <motion.h1
              initial={{ skewX: 0, x: 0 }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      skewX: [0, -2, 1.5, -1, 0],
                      x: [0, -2, 2, -1, 0],
                    }
              }
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 2.8,
                ease: 'easeInOut',
              }}
              className="relative font-mono font-black tracking-tighter text-[6.5rem] sm:text-[10rem] md:text-[13rem] gradient-text select-none"
            >
              404
            </motion.h1>
          </div>

          {/* Friendly Spanish message */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 text-foreground"
          >
            ¡Ups! Esta página no existe
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-sm sm:text-base text-muted-foreground mb-8 max-w-md"
          >
            Parece que esta página no existe o fue movida a otro castillo.
          </motion.p>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
          >
            {/* Primary: uses SPA store + client navigation. Always rendered
                (setView is a plain Zustand setter, no hydration mismatch) */}
            <Button
              onClick={handleGoHome}
              className="btn-gradient-primary h-11 px-6 text-base gap-2 w-full sm:w-auto"
              size="lg"
            >
              <Home className="h-5 w-5" />
              Volver al inicio
            </Button>
            {/* Volver a la página anterior 🡐 */}
            <Button
              onClick={handleGoBack}
              variant="outline"
              className="h-11 px-6 text-base gap-2 w-full sm:w-auto"
              size="lg"
            >
              <ArrowLeft className="h-5 w-5" />
              Volver atrás
            </Button>
            {/* Fallback: plain anchor that always works, even with JS off
                or when reached via a direct URL */}
            <Button
              asChild
              variant="outline"
              className="h-11 px-6 text-base gap-2 w-full sm:w-auto"
              size="lg"
            >
              <a href="/">
                <ArrowLeft className="h-5 w-5" />
                Recargar DevPlay
              </a>
            </Button>
          </motion.div>
        </div>
      </main>

      {/* Sticky footer (pushed to bottom by flex-col) */}
      <footer className="relative z-10 mt-auto glass-strong border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© 2025 DevPlay — Red social para devs de videojuegos indie</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-olive-400 live-pulse" />
              Error 404 · Página no encontrada
            </span>
            <span>MVP v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
