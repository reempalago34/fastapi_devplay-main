'use client'

import { Plus, FileText, Gamepad, Video, BarChart3 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Dock de creación 📍 — botón "Crear" flotante en la PARTE BAJA de la pantalla.
 * Reemplaza al botón de la esquina superior en móvil y tablet (< lg).
 * En desktop el Crear sigue viviendo en el header.
 */
export function CreateDock() {
  const { t } = useT()
  const { user, isAuthed, isGuest } = useCurrentUser()
  const { openCreatePost, openCreateBeta, openCreatePoll, currentView } = useUIStore()

  const canCreate = isAuthed && !isGuest
  // En el Chat Mundial se oculta: taparía la caja de escribir 💬
  if (!canCreate || currentView === 'chat') return null

  return (
    <div className={cn('fixed bottom-3 left-1/2 -translate-x-1/2 z-50 lg:hidden')} data-tour="create">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="btn-gradient-primary flex h-12 items-center gap-2 rounded-full px-6 text-sm font-bold text-white shadow-xl ring-2 ring-background/60 transition active:scale-95"
            aria-label={t('Crear contenido')}
          >
            <Plus className="h-5 w-5" />
            {t('Crear')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          side="top"
          className="w-52 rounded-md mb-1"
        >
          <DropdownMenuItem onClick={openCreateBeta} className="rounded-lg">
            <Gamepad className="mr-2 h-4 w-4 text-amber-500" />
            {t('Subir Beta')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openCreatePost} className="rounded-lg">
            <Video className="mr-2 h-4 w-4 text-wine-500" />
            {t('Subir Video')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openCreatePoll} className="rounded-lg">
            <BarChart3 className="mr-2 h-4 w-4 text-olive-500" />
            {t('Encuesta')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
