'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Home,
  Compass,
  User,
  Radio,
  Gamepad2,
  FileText,
  Radio as RadioIcon,
  Sparkles,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'
import { UserAvatar } from './shared'

const navItems = [
  { id: 'feed' as const, label: 'Inicio', icon: Home },
  { id: 'explore' as const, label: 'Explorar', icon: Compass },
]

export function Sidebar() {
  const { currentView, setView, openProfile, openCreatePost, openCreateBeta, openGoLive } = useUIStore()
  const { user, isAuthed, isGuest } = useCurrentUser()

  const canCreate = isAuthed && !isGuest
  const isDev = user?.role === 'DEV'

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col gap-1 p-3 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto custom-scroll">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = currentView === item.id
          return (
            <Button
              key={item.id}
              variant={active ? 'secondary' : 'ghost'}
              className={cn('w-full justify-start gap-3 h-11', active && 'glass')}
              onClick={() => setView(item.id)}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Button>
          )
        })}
      </nav>

      {canCreate && (
        <>
          <div className="my-2 h-px bg-border" />
          <p className="px-3 pb-1 text-xs font-semibold uppercase text-muted-foreground">Crear</p>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-10"
            onClick={openCreatePost}
          >
            <FileText className="h-4 w-4" />
            Nueva publicación
          </Button>
          {isDev && (
            <>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-10"
                onClick={openCreateBeta}
              >
                <Gamepad2 className="h-4 w-4" />
                Subir beta
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-10"
                onClick={openGoLive}
              >
                <RadioIcon className="h-4 w-4" />
                Iniciar directo
              </Button>
            </>
          )}
        </>
      )}

      <div className="my-2 h-px bg-border" />

      {/* User card */}
      {user ? (
        <button
          onClick={() => openProfile(user.id)}
          className="glass-card flex w-full items-center gap-3 p-3 text-left hover:scale-[1.02] transition"
        >
          <UserAvatar username={user.username} avatar={user.avatar} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-muted-foreground">
              {user.isGuest ? 'Invitado' : user.role === 'DEV' ? 'Desarrollador' : 'Jugador'}
            </p>
          </div>
        </button>
      ) : (
        <div className="glass-card p-4 text-center">
          <p className="mb-2 text-sm text-muted-foreground">
            Únete para comentar, dar like y seguir a tus devs favoritos
          </p>
        </div>
      )}

      <div className="mt-auto pt-4 text-center text-[10px] text-muted-foreground">
        <p>DevPlay v1.0 MVP</p>
        <p>Hecho con ❤️ para devs indie</p>
      </div>
    </aside>
  )
}
