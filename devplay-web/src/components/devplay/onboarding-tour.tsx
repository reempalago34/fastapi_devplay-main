'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useT } from '@/lib/i18n'

/**
 * Tour guiado de DevPlay — "Terracota & Crema" 🧡
 *
 * - Solo se lanza SOLO a usuarios NUEVOS y UNA sola vez: la marca vive en la
 *   BD (User.tourCompleted), así que aunque cambien de navegador no se repite.
 * - Los usuarios que ya existían nacen con tourCompleted=true (DDL) → jamás
 *   lo ven de forma automática.
 * - Se puede relanzar a mano desde el sidebar (Ayuda → Tour guiado) con
 *   tourNonce; eso no cambia el estado "una vez".
 * - Último paso centrado en pantalla y botón final "Explorar".
 */
export function OnboardingTour() {
  const { tourNonce, setOnboardingDone } = useUIStore()
  const { user } = useCurrentUser()
  const { t } = useT()
  const qc = useQueryClient()
  const driverRef = useRef<Driver | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    // Solo devs registrados (no invitados) y solo si NO ha visto el tour
    if (!user || user.isGuest) return

    const markTourDone = () => {
      setOnboardingDone(true)
      driverRef.current = null
      // El tour se marca en localStorage: PATCH /users/me/profile de FastAPI
      // no tiene campo `tourCompleted`, asi que no lo pierde el servidor.
      try {
        localStorage.setItem('devplay:onboarding-done', '1')
      } catch {}
      qc.invalidateQueries({ queryKey: ['devplay', 'me'] }).catch(() => {})
    }

    const buildAndDrive = () => {
      const header = document.getElementById('devplay-header')
      const sidebar = document.querySelector('aside nav') as HTMLElement | null
      // El botón Crear existe dos veces (header desktop + dock móvil): usar el VISIBLE
      // Nota: los elementos fixed tienen offsetParent null → usar rect + checkVisibility
      const isVisible = (el: HTMLElement) => {
        if (typeof el.checkVisibility === 'function') return el.checkVisibility()
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }
      const createBtn = (
        Array.from(document.querySelectorAll<HTMLElement>('[data-tour="create"]')).find(isVisible) ?? null
      )
      const chatPanel = document.querySelector('[data-tour="chat-panel"]') as HTMLElement | null
      const buddy = document.querySelector('[data-tour="pixel-buddy"]') as HTMLElement | null

      const steps = [
        header && {
          element: header,
          popover: {
            title: t('¡Hola, bienvenida o bienvenida a DevPlay! 🎮'),
            description:
              t('Esta es tu plaza retro para devs indie. Aquí puedes descubrir juegos y betas, conocer devs y compartir lo que estás creando. Te damos la vuelta rápida ✨'),
            side: 'bottom' as const,
            align: 'start' as const,
          },
        },
        sidebar && {
          element: sidebar,
          popover: {
            title: t('Todo el universo DevPlay'),
            description:
              t('Desde este menú te mueves por la plaza: Inicio, Descubrir, Betas, Videos, Chat Mundial y Tienda. En "Comunidad" tienes atajos rápidos y en "Mi biblioteca" todo lo que guardaste. ✦'),
            side: 'right' as const,
            align: 'start' as const,
          },
        },
        chatPanel && {
          element: chatPanel,
          popover: {
            title: t('La plaza pública, en vivo ☕'),
            description:
              t('El chat mundial: devs de todo el mundo conversando en tiempo real. Preséntate, comparte tu devlog de la semana y encuentra a tus aliados para tu próximo juego.'),
            side: 'left' as const,
            align: 'start' as const,
          },
        },
        createBtn && {
          element: createBtn,
          popover: {
            title: t('Crea y comparte lo tuyo 🚀'),
            description:
              t('Publica devlogs con fotos y videos, sube la beta de tu juego para que la prueben, lanza encuestas o anuncia tus streams. La comunidad quiere ver lo que haces.'),
            side: 'bottom' as const,
            align: 'end' as const,
          },
        },
        buddy && {
          element: buddy,
          popover: {
            title: t('Pixel, tu compañero de plaza 🤖'),
            description:
              t('Este botoncito camina por la pantalla contigo. Tócalo y pregúntale lo que quieras: cómo subir una beta, ideas para tu juego o tips para conectar con otros devs.'),
            side: 'top' as const,
            align: 'end' as const,
          },
        },
        {
          // Sin elemento → driver.js centra el popover en pantalla ✨
          popover: {
            title: t('Un último consejo 💛'),
            description:
              t('DevPlay es una plaza amable: da feedback con cariño, celebra los logros de los demás devs y cuéntanos qué estás creando esta semana. Ahora sí… ¡te toca explorar!'),
          },
        },
      ].filter(Boolean) as {
        element?: string | HTMLElement
        popover: { title: string; description: string; side?: 'top' | 'bottom' | 'left' | 'right'; align?: 'start' | 'center' | 'end' }
      }[]

      const drv = driver({
        popoverClass: 'driverjs-theme', // ← activa el tema crema/terracota
        showProgress: true,
        allowClose: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: t('Siguiente →'),
        prevBtnText: t('← Atrás'),
        doneBtnText: t('Explorar 🧭'),
        steps,
        onDestroyed: markTourDone,
      })

      driverRef.current = drv
      drv.drive()
    }

    // Modo manual: tourNonce > 0 → lanzar al instante (botón "Tour guiado")
    if (tourNonce > 0) {
      buildAndDrive()
      return
    }

    // Modo automático: solo usuarios NUEVOS (tourCompleted=false en BD), una vez
    if (user.tourCompleted) return
    if (startedRef.current) return
    startedRef.current = true
    // ⚠️ SIN clearTimeout en el cleanup: cuando user se refresca (React Query
    // crea un objeto nuevo) el efecto se re-ejecuta y antes MATABA el timer
    // pendiente sin reprogramarlo → el tour nunca arrancaba 🫠.
    // startedRef ya evita duplicados, así que el timer vive su vida.
    setTimeout(buildAndDrive, 1200)
  }, [user, tourNonce, setOnboardingDone, qc])

  return null
}
