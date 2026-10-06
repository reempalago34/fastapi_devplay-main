'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { authService } from '@/services/devplay-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Gamepad2,
  Search,
  Sun,
  Moon,
  Bell,
  Plus,
  Radio,
  Gamepad,
  FileText,
  LogOut,
  User as UserIcon,
  Sparkles,
  Menu,
  MessageSquare,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { type NotificationItem } from '@/lib/devplay-api'
import { notificationService } from '@/services/devplay-service'
import { useLiveNotifications } from '@/hooks/use-socket'
import { toast } from 'sonner'
import { UserAvatar } from './shared'
import { TimeAgo } from './shared'

export function Header() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { user, isAuthed, isGuest, refresh, logoutGuest } = useCurrentUser()
  const {
    openAuth,
    openCreatePost,
    openCreateBeta,
    openGoLive,
    openProfile,
    setView,
    toggleChat,
  } = useUIStore()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  // Load notifications
  const loadNotifs = async () => {
    if (!user) return
    try {
      const { notifications: n, unread: u } = await notificationService.list()
      setNotifications(n)
      setUnread(u)
    } catch {}
  }

  useEffect(() => {
    if (!user) return
    // Defer to avoid synchronous setState in effect body
    const initial = setTimeout(loadNotifs, 0)
    const interval = setInterval(loadNotifs, 30000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [user?.id])

  // Real-time live notifications
  useLiveNotifications((n) => {
    toast(`🎮 ${n.username} está en vivo ahora mismo`, {
      description: n.title,
      duration: 8000,
      action: {
        label: 'Ver',
        onClick: () => setView('feed'),
      },
    })
    loadNotifs()
  })

  async function handleNotifOpen(open: boolean) {
    setNotifOpen(open)
    if (open && unread > 0) {
      try {
        await notificationService.markNotificationsRead()
        setUnread(0)
      } catch {}
    }
  }

  async function handleSignOut() {
    if (isGuest) {
      logoutGuest()
      toast.success('Sesión de invitado cerrada')
    } else {
      await authService.logout()
      await refresh()
      toast.success('Sesión cerrada')
    }
  }

  const canCreate = isAuthed && !isGuest
  const isDev = user?.role === 'DEV'

  return (
    <header
      id="devplay-header"
      className="glass-strong sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-3 sm:px-4"
    >
      {/* Logo */}
      <button
        onClick={() => setView('feed')}
        className="flex items-center gap-2 shrink-0"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
          <Gamepad2 className="h-5 w-5" />
        </div>
        <span className="hidden sm:block text-lg font-bold gradient-text">DevPlay</span>
      </button>

      {/* Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-2">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar juegos, devs, betas..."
            className="glass pl-9 h-9"
          />
        </div>
      </div>

      <div className="flex-1 md:hidden" />

      {/* Create menu */}
      {canCreate && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="hidden sm:flex" data-tour="create">
              <Plus className="h-4 w-4 mr-1" />
              Crear
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="sm:hidden" data-tour="create">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={openCreatePost}>
              <FileText className="mr-2 h-4 w-4" />
              Publicación
            </DropdownMenuItem>
            {isDev && (
              <DropdownMenuItem onClick={openCreateBeta}>
                <Gamepad className="mr-2 h-4 w-4" />
                Subir Beta
              </DropdownMenuItem>
            )}
            {isDev && (
              <DropdownMenuItem onClick={openGoLive}>
                <Radio className="mr-2 h-4 w-4" />
                Iniciar Directo
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title="Cambiar tema"
      >
        {mounted && theme === 'dark' ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>

      {/* Chat toggle (mobile) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleChat}
        className="lg:hidden"
        title="Chat mundial"
      >
        <MessageSquare className="h-5 w-5" />
      </Button>

      {/* Notifications */}
      {user && (
        <DropdownMenu open={notifOpen} onOpenChange={handleNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white live-pulse">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto custom-scroll">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notificaciones</span>
              {unread > 0 && <Badge variant="secondary">{unread} nuevas</Badge>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Sin notificaciones aún
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => {
                /* El autor puede no venir (la API solo manda id y username), asi
                   que se cae a un objeto vacio en vez de romper el render. */
                const from = n.fromUser ?? { username: '', avatar: null }
                return (
                  <DropdownMenuItem key={n.id} className="flex items-start gap-2 py-2">
                    <UserAvatar username={from.username} avatar={from.avatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{n.message}</p>
                      <TimeAgo date={n.createdAt ?? ''} />
                    </div>
                    {n.type === 'LIVE' && (
                      <span className="rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        LIVE
                      </span>
                    )}
                  </DropdownMenuItem>
                )
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* User menu / Login */}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-primary/30 transition">
              <UserAvatar username={user.username} avatar={user.avatar} size="sm" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{user.username}</span>
                <span className="text-xs text-muted-foreground">
                  {user.isGuest ? 'Invitado' : user.role === 'DEV' ? 'Desarrollador' : 'Jugador'}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openProfile(user.id)}>
              <UserIcon className="mr-2 h-4 w-4" />
              Mi perfil
            </DropdownMenuItem>
            {!isGuest && user.role !== 'DEV' && (
              <DropdownMenuItem
                onClick={async () => {
                  /* El rol no se cambia por PATCH /users/me/profile: la API solo
                     acepta los campos de perfil (bio, avatar, tags...) y el rol lo
                     decide el backend. Antes se mandaba `role` y se perdia en
                     silencio, asi que el menu avisa de que falta el endpoint. */
                  toast.error('Todavía no hay endpoint para cambiar el rol en la API.')
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Convertirme en Dev
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button size="sm" onClick={() => openAuth('login')}>
          Entrar
        </Button>
      )}
    </header>
  )
}
