'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { RetroScreen, RetroPrimaryButton } from '@/components/devplay/shared/retro-screen'

/**
 * OfflineWatcher 📡 — cubre la app con la pantalla retro "Sin conexión"
 * cuando el usuario pierde internet (wifi/datos) y se regresa solo al
 * volver la conexión. Misma pantalla bonita que el 404 y el error.
 */
export function OfflineWatcher() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <RetroScreen
      overlay
      icon={WifiOff}
      badge="Sin conexión"
      title="Se cortó internet 📴"
      message="DevPlay es una plaza en vivo, así que necesita conexión para todo. Revisa tu wifi o tus datos móviles y dale Reintentar cuando vuelvas."
      actions={
        <RetroPrimaryButton onClick={() => window.location.reload()}>
          <RefreshCw className="h-5 w-5" />
          Reintentar
        </RetroPrimaryButton>
      }
    />
  )
}
