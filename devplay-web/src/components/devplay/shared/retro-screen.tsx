'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Partículas pixel: configuración estable calculada una sola vez (CSS puro)
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${(i * 61) % 100}%`,
  top: `${(i * 43 + 7) % 100}%`,
  size: 4 + (i % 4) * 3,
  delay: `${((i * 0.41) % 3).toFixed(2)}s`,
  duration: `${(7 + (i % 5) * 1.4).toFixed(1)}s`,
}))

/**
 * RetroScreen 🌅 — pantalla retro compartida para situaciones de sistema:
 * 404, error inesperado y "sin conexión". Atardecer 70s (sol con ranuras),
 * partículas flotantes y scanlines CRT. Estética Terracota & Crema.
 */
export function RetroScreen({
  icon: Icon,
  badge,
  title,
  message,
  actions,
  note,
  overlay = false,
}: {
  icon: LucideIcon
  badge: string
  title: string
  message: string
  actions?: React.ReactNode
  note?: string
  overlay?: boolean // true = cubre toda la app (p.ej. watcher de conexión)
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      className={
        overlay
          ? 'fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-background text-foreground'
          : 'relative min-h-screen flex flex-col overflow-hidden bg-background text-foreground'
      }
    >
      <style>{`
        @keyframes rs-pixel-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.16; }
          50%      { transform: translate3d(6px, -14px, 0) scale(1.25); opacity: 0.42; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rs-pixel { animation: none !important; opacity: 0.2 !important; }
        }
        .rs-scanlines {
          background-image: repeating-linear-gradient(
            0deg, transparent 0, transparent 2px,
            currentColor 2px, currentColor 3px
          );
        }
      `}</style>

      {/* ===== Atardecer 70s: sol con ranuras + arcos ===== */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        {/* Resplandores difusos */}
        <div
          className="absolute left-1/2 top-[38%] h-[62vh] w-[62vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 38%, transparent), transparent 70%)' }}
        />
        <div
          className="absolute right-[10%] top-[14%] h-40 w-40 rounded-full opacity-20 blur-2xl"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--accent) 75%, transparent), transparent 70%)' }}
        />
        {/* El sol: círculo cálido con cortinas horizontales */}
        <div
          className="absolute bottom-[-22%] left-1/2 h-[52vh] w-[52vh] -translate-x-1/2 rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(to top, color-mix(in oklch, var(--primary) 72%, black) 0%, var(--primary) 45%, color-mix(in oklch, var(--primary) 55%, oklch(0.85 0.14 85)) 100%)',
            opacity: 0.28,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(to bottom, transparent 0 22px, var(--background) 22px 30px)',
              opacity: 0.85,
            }}
          />
        </div>
        {/* Partículas pixel */}
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="rs-pixel absolute block rounded-[2px]"
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: 'color-mix(in oklch, var(--primary) 75%, transparent)',
              animation: reduceMotion ? 'none' : `rs-pixel-float ${p.duration} ease-in-out ${p.delay} infinite`,
              opacity: 0.22,
            }}
          />
        ))}
        {/* Scanlines CRT */}
        <div className="rs-scanlines absolute inset-0 opacity-[0.05] text-foreground mix-blend-overlay" />
      </div>

      {/* ===== Contenido ===== */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center text-center max-w-xl mx-auto">
          {/* Insignia del icono */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7"
          >
            <motion.div
              animate={reduceMotion ? undefined : { y: [0, -8, 0], rotate: [-3, 3, -3] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative grid place-items-center"
            >
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-60"
                style={{ background: 'color-mix(in oklch, var(--primary) 45%, transparent)' }}
              />
              <div className="relative grid place-items-center h-20 w-20 sm:h-24 sm:w-24 rounded-lg glass-card frame-double">
                <Icon className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
              </div>
            </motion.div>
          </motion.div>

          {/* Badge */}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="label-caps mb-3"
          >
            ✦ {badge} ✦
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="font-display text-3xl sm:text-4xl md:text-5xl font-black mb-4 text-foreground leading-tight"
          >
            {title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="text-sm sm:text-base text-muted-foreground mb-9 max-w-md leading-relaxed"
          >
            {message}
          </motion.p>

          {actions && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center"
            >
              {actions}
            </motion.div>
          )}

          {note && (
            <p className="mt-6 text-[11px] text-muted-foreground/70 font-mono select-all">{note}</p>
          )}
        </div>
      </main>

      {/* Pie */}
      <footer className="relative z-10 mt-auto glass-strong border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© 2025 DevPlay — Red social para devs de videojuegos indie</p>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary live-pulse" />
            {badge}
          </span>
        </div>
      </footer>
    </div>
  )
}

/** Botón primario estándar para las pantallas retro */
export function RetroPrimaryButton({
  onClick,
  children,
}: {
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Button onClick={onClick} className="btn-gradient-primary h-11 px-6 text-base gap-2 w-full sm:w-auto" size="lg">
      {children}
    </Button>
  )
}

/** Botón secundario estándar para las pantallas retro */
export function RetroSecondaryButton({
  onClick,
  children,
  href,
}: {
  onClick?: () => void
  children: React.ReactNode
  href?: string
}) {
  if (href) {
    return (
      <Button asChild variant="outline" className="h-11 px-6 text-base gap-2 w-full sm:w-auto" size="lg">
        <a href={href}>{children}</a>
      </Button>
    )
  }
  return (
    <Button onClick={onClick} variant="outline" className="h-11 px-6 text-base gap-2 w-full sm:w-auto" size="lg">
      {children}
    </Button>
  )
}
