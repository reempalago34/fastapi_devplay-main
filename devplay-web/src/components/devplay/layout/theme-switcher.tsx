'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check, Palette, X } from 'lucide-react'
import { useColorThemeStore, COLOR_THEMES, type ColorTheme } from '@/lib/theme-store'
import { cn } from '@/lib/utils'

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const colorTheme = useColorThemeStore((s) => s.colorTheme)
  const setColorTheme = useColorThemeStore((s) => s.setColorTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const currentTheme = COLOR_THEMES.find((t) => t.id === colorTheme)

  function applyTheme(theme: ColorTheme) {
    setColorTheme(theme)
    // Aplicar inmediatamente al DOM
    document.documentElement.setAttribute('data-theme', theme)
  }

  if (compact) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="rounded-full h-9 w-9"
          aria-label="Cambiar tema de color"
          title="Temas de color"
        >
          <Palette className="h-5 w-5 shrink-0" />
        </Button>
        <ThemeSwitcherModal open={open} onClose={() => setOpen(false)} currentTheme={colorTheme} onApply={applyTheme} />
      </>
    )
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-wine-400 to-wine-500 text-white">
          <Palette className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Apariencia</h3>
          <p className="text-[10px] text-muted-foreground">Elige tu tema de color</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {mounted && COLOR_THEMES.map((theme) => {
          const active = colorTheme === theme.id
          return (
            <button
              key={theme.id}
              onClick={() => applyTheme(theme.id)}
              className={cn(
                'group relative flex items-center gap-3 rounded-md border-2 p-3 transition-all',
                active ? 'border-primary shadow-md' : 'border-border hover:border-primary/40'
              )}
            >
              {/* Miniatura preview */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white text-lg shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${theme.preview.primary}, ${theme.preview.accent})`,
                }}
              >
                {theme.emoji}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold truncate">{theme.label}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{theme.description}</p>
              </div>

              {/* Check si activo */}
              {active && (
                <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Preview grande del tema actual */}
      {mounted && currentTheme && (
        <div className="mt-3 rounded-md p-3" style={{ background: currentTheme.preview.bg }}>
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: currentTheme.preview.accent }}>
            Vista previa · {currentTheme.label}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm"
              style={{ background: currentTheme.preview.primary }}
            >
              Botón primario
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium shadow-sm border"
              style={{
                background: 'transparent',
                borderColor: currentTheme.preview.accent,
                color: currentTheme.preview.accent,
              }}
            >
              Botón secundario
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Modal compacto para el header =====
function ThemeSwitcherModal({
  open,
  onClose,
  currentTheme,
  onApply,
}: {
  open: boolean
  onClose: () => void
  currentTheme: ColorTheme
  onApply: (theme: ColorTheme) => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed left-1/2 top-20 z-50 -translate-x-1/2 w-full max-w-sm glass-strong rounded-lg border border-border/50 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Temas de color</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Grid de temas */}
            <div className="p-3 grid grid-cols-1 gap-2">
              {COLOR_THEMES.map((theme) => {
                const active = currentTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      onApply(theme.id)
                      onClose()
                    }}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md border-2 p-2.5 transition-all',
                      active ? 'border-primary shadow-md' : 'border-border hover:border-primary/40'
                    )}
                  >
                    {/* Miniatura */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white text-base shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${theme.preview.primary}, ${theme.preview.accent})`,
                      }}
                    >
                      {theme.emoji}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-semibold truncate">{theme.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{theme.description}</p>
                    </div>

                    {/* Check */}
                    {active && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="p-3 border-t border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground">
                El cambio es instantáneo y se guarda automáticamente
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
