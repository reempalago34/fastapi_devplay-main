'use client'

import { useEffect } from 'react'
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from 'lucide-react'
import { RetroScreen, RetroPrimaryButton, RetroSecondaryButton } from '@/components/devplay/shared/retro-screen'

/**
 * Página de error de runtime (app/error.tsx) 🌋
 * Cuando un componente explota, esta pantalla bonita lo recoge:
 * "Algo salió mal" + Reintentar + Volver al inicio / atrás.
 *
 * ⚠️ Los botones usan navegación DURA (window.location) a propósito:
 * después de un crash el router de Next puede quedar en mal estado, y
 * router.push('/') / reset() vuelven a montar el mismo árbol roto —
 * el usuario los clicaba y "no pasaba nada". Una recarga o navegación
 * completa SIEMPRE recupera la app, por eso:
 *  - Reintentar      → recarga completa de la página
 *  - Volver al inicio → enlace real a "/" (carga completa)
 *  - Volver atrás    → historial del navegador con red de seguridad a "/"
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Dejamos rastro del error en consola para poder diagnosticarlo
  useEffect(() => {
    console.error('[DevPlay] Error de runtime:', error)
  }, [error])

  return (
    <RetroScreen
      icon={AlertTriangle}
      badge="Error inesperado"
      title="¡Ups! Algo salió mal"
      message="La plaza dio un tropiezo, pero no pasa nada: dale Reintentar y seguimos jugando. Si el problema sigue, vuelve en un ratito."
      note={error?.digest ? `Código de seguimiento: ${error.digest}` : undefined}
      actions={
        <>
          <RetroPrimaryButton onClick={() => window.location.reload()}>
            <RefreshCw className="h-5 w-5" />
            Reintentar
          </RetroPrimaryButton>
          <RetroSecondaryButton href="/">
            <Home className="h-5 w-5" />
            Volver al inicio
          </RetroSecondaryButton>
          <RetroSecondaryButton
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back()
              } else {
                window.location.assign('/')
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
            Volver atrás
          </RetroSecondaryButton>
        </>
      }
    />
  )
}
