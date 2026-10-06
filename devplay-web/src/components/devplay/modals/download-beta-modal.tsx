'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { betaService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { toast } from 'sonner'
import {
  X, Download, Loader2, Check, AlertTriangle, Info,
  Monitor, FileArchive, Link2, Gamepad2, Clock,
} from 'lucide-react'
import { BetaStatusBadge, formatBytes } from '@/components/devplay/shared/shared'
import { getBetaStatusMeta } from '@/types/devplay'
import { cn } from '@/lib/utils'

export function DownloadBetaModal({
  open,
  onClose,
  postId,
  beta,
  authorName,
}: {
  open: boolean
  onClose: () => void
  postId: string
  beta: any
  authorName: string
}) {
  const { isAuthed, isGuest } = useCurrentUser()
  const { openAuth } = useUIStore()
  const [agreed, setAgreed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  if (!beta) return null

  const canDownload = isAuthed && !isGuest
  const statusMeta = getBetaStatusMeta(beta.betaStatus)
  const isEnded = beta.betaStatus === 'ended'
  const isComingSoon = beta.betaStatus === 'coming_soon'

  async function handleDownload() {
    if (!canDownload) {
      openAuth('login')
      return
    }
    if (!agreed) return

    setDownloading(true)
    try {
      /* Registrar la descarga es un POST, hay que esperar la URL antes de abrirla. */
        const url = await betaService.downloadUrl(postId)
        window.open(url, '_blank')
      setDownloaded(true)
      toast.success('Descarga iniciada')
      setTimeout(() => {
        onClose()
        setDownloaded(false)
        setAgreed(false)
      }, 2000)
    } catch {
      toast.error('Error al descargar')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[65] bg-black/60"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-[66] -translate-x-1/2 -translate-y-1/2 w-full max-w-md glass-strong rounded-lg border border-border/50 shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="relative shrink-0">
              {/* Cover background */}
              <div className={cn('h-24 relative overflow-hidden bg-gradient-to-br', statusMeta.color)}>
                {beta.coverImage && (
                  <img src={beta.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur text-white hover:bg-black/70 transition"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Title overlay */}
              <div className="absolute bottom-2 left-3 right-3 text-white">
                <div className="flex items-center gap-2 mb-0.5">
                  <BetaStatusBadge status={beta.betaStatus} />
                  {beta.version && (
                    <span className="rounded-full bg-white/20 backdrop-blur px-2 py-0.5 text-[9px] font-bold">
                      {beta.version}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold drop-shadow">{beta.title}</h2>
                <p className="text-[10px] opacity-80">por @{authorName}</p>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3">
              {/* Estado no disponible */}
              {(isEnded || isComingSoon) && (
                <div className="flex items-center gap-2 rounded-md border-2 border-amber-500/30 bg-amber-500/5 p-3">
                  <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {isEnded ? 'Esta beta ha finalizado' : 'Esta beta aún no está disponible'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isEnded
                        ? 'Ya no es posible descargar este juego. Consulta otras betas disponibles.'
                        : 'Mantente atento, el desarrollador la publicará pronto.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Info del juego */}
              <div className="glass rounded-md p-3 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> Información del juego
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {beta.genre && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Género</p>
                      <p className="font-medium">{beta.genre}</p>
                    </div>
                  )}
                  {beta.version && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Versión</p>
                      <p className="font-medium">{beta.version}</p>
                    </div>
                  )}
                  {beta.platforms && beta.platforms.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground">Plataformas</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Monitor className="h-3 w-3 text-muted-foreground" />
                        <p className="font-medium">{beta.platforms.join(', ')}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground">Tipo de descarga</p>
                    <div className="flex items-center gap-1">
                      {beta.downloadType === 'DIRECT' ? (
                        <><FileArchive className="h-3 w-3" /> <span className="font-medium">Archivo directo</span></>
                      ) : (
                        <><Link2 className="h-3 w-3" /> <span className="font-medium">{beta.externalPlatform ?? 'Enlace externo'}</span></>
                      )}
                    </div>
                  </div>
                  {beta.fileSize && beta.downloadType === 'DIRECT' && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Tamaño</p>
                      <p className="font-medium">{formatBytes(beta.fileSize)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground">Descargas</p>
                    <p className="font-medium">{beta.downloads} veces</p>
                  </div>
                </div>
              </div>

              {/* Requisitos (si hay) */}
              {beta.requirements && (
                <div className="glass rounded-md p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                    <Monitor className="h-3 w-3" /> Requisitos del sistema
                  </h3>
                  <pre className="text-[11px] whitespace-pre-wrap font-sans text-muted-foreground">{beta.requirements}</pre>
                </div>
              )}

              {/* Instrucciones de instalación (si hay) */}
              {beta.installInstructions && (
                <div className="glass rounded-md p-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                    <Gamepad2 className="h-3 w-3" /> Cómo instalar
                  </h3>
                  <pre className="text-[11px] whitespace-pre-wrap font-sans text-muted-foreground">{beta.installInstructions}</pre>
                </div>
              )}

              {/* Advertencia de beta */}
              {!isEnded && !isComingSoon && (
                <div className="flex items-start gap-2 rounded-md border-2 border-amber-500/30 bg-amber-500/5 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    <p className="font-bold">Esto es una versión beta</p>
                    <p className="mt-0.5">
                      El juego está en desarrollo. Puede contener bugs, fallos y características incompletas.
                      Tu feedback ayuda a mejorarlo.
                    </p>
                  </div>
                </div>
              )}

              {/* Checkbox de confirmación */}
              {!isEnded && !isComingSoon && (
                <label className="flex items-start gap-2 cursor-pointer glass rounded-md p-3">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-xs text-foreground/80">
                    Entiendo que es una versión en desarrollo y acepto participar en las pruebas.
                    Reportaré los bugs que encuentre al desarrollador.
                  </span>
                </label>
              )}
            </div>

            {/* Footer con botón de descarga */}
            <div className="shrink-0 border-t border-border/50 p-4">
              {!canDownload && !isEnded && !isComingSoon ? (
                <Button
                  className="w-full btn-gradient-beta rounded-sm gap-1.5"
                  onClick={() => openAuth('login')}
                >
                  <Download className="h-4 w-4" />
                  Inicia sesión para descargar
                </Button>
              ) : isEnded || isComingSoon ? (
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={onClose}
                  disabled
                >
                  {isEnded ? 'Beta finalizada' : 'Próximamente'}
                </Button>
              ) : downloaded ? (
                <div className="flex items-center justify-center gap-2 text-olive-500 text-sm font-medium">
                  <Check className="h-5 w-5" />
                  ¡Descarga iniciada!
                </div>
              ) : (
                <Button
                  className="w-full btn-gradient-beta rounded-sm gap-1.5"
                  onClick={handleDownload}
                  disabled={!agreed || downloading}
                >
                  {downloading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Preparando descarga...</>
                  ) : (
                    <><Download className="h-4 w-4" /> Descargar beta {beta.downloadType === 'LINK' ? `(ir a ${beta.externalPlatform ?? 'enlace'})` : ''}</>
                  )}
                </Button>
              )}
              {!agreed && canDownload && !isEnded && !isComingSoon && (
                <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                  Marca la casilla para habilitar la descarga
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
