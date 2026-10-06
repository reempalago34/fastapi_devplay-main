'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Video,
  Gamepad,
  FileText,
  BarChart3,
  LogOut,
  User as UserIcon,
  Menu,
  Settings,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useT } from '@/lib/i18n'
import { notificationService, authService } from '@/services/devplay-service'
import { useLiveNotifications } from '@/hooks/use-socket'
import { toast } from 'sonner'
import { UserAvatar, TimeAgo, UserTags } from '@/components/devplay/shared/shared'
import { SearchModal } from '@/components/devplay/layout/search-modal'
import { cn } from '@/lib/utils'
import type { NotificationItem } from '@/types/devplay'

export function Header() {
  const { t } = useT()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { user, isAuthed, isGuest, refresh, logoutGuest } = useCurrentUser()
  const {
    openAuth,
    openCreatePost,
    openCreateBeta,
    openCreatePoll,
    openProfile,
    setView,
    toggleMobileSidebar,
    mobileSidebarOpen,
    openSettings,
  } = useUIStore()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const loadNotifs = useCallback(async () => {
    try {
      const { notifications: n, unread: u } = await notificationService.list()
      setNotifications(n)
      setUnread(u)
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    const initial = setTimeout(loadNotifs, 500)
    const interval = setInterval(loadNotifs, 60000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [user?.id, loadNotifs])

  const onLive = useCallback((n: any) => {
    toast(`${n.username} está en vivo ahora mismo`, {
      description: n.title,
      duration: 8000,
      action: { label: 'Ver', onClick: () => setView('explore') },
    })
    loadNotifs()
  }, [setView, loadNotifs])
  useLiveNotifications(onLive)

  async function handleNotifOpen(open: boolean) {
    setNotifOpen(open)
    if (open && unread > 0) {
      try {
        await notificationService.markRead()
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

  return (
    <header
      id="devplay-header"
      className="glass-strong sticky top-0 z-40 flex h-16 items-center gap-2 border-b-[3px] border-double border-border px-3 sm:px-4"
    >
      {/* Botón menú móvil — hamburguesa animada */}
      <button
        onClick={toggleMobileSidebar}
        className="lg:hidden relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary/60 transition"
        aria-label="Abrir menú"
      >
        <span className="relative flex h-4 w-5 flex-col justify-between">
          <span
            className={cn(
              'block h-0.5 w-full rounded-full bg-foreground transition-all duration-300',
              mobileSidebarOpen && 'absolute top-1.5 rotate-45'
            )}
          />
          <span
            className={cn(
              'block h-0.5 w-full rounded-full bg-foreground transition-all duration-300',
              mobileSidebarOpen && 'opacity-0'
            )}
          />
          <span
            className={cn(
              'block h-0.5 w-full rounded-full bg-foreground transition-all duration-300',
              mobileSidebarOpen && 'absolute top-1.5 -rotate-45'
            )}
          />
        </span>
      </button>

      {/* Logo */}
      <button
        onClick={() => setView('explore')}
        className="flex items-center gap-2 shrink-0"
      >
        <img
          src="/logo-devplay.png"
          alt="DevPlay"
          className="h-9 w-9 rounded-md object-cover"
        />
        <span className="hidden sm:block font-display text-xl font-bold tracking-tight text-foreground">DevPlay</span>
      </button>

      {/* Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="glass w-full flex items-center gap-2 h-9 rounded-sm px-3 text-sm text-muted-foreground hover:bg-secondary/80 transition italic"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span>{t('Buscar juegos, devs, betas...')}</span>
        </button>
      </div>

      {/* Mobile search button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSearchOpen(true)}
        className="md:hidden rounded-full"
        aria-label="Buscar"
      >
        <Search className="h-5 w-5" />
      </Button>

      <div className="flex-1 md:hidden" />

      {/* Create menu — SOLO desktop (lg+); en móvil/tablet vive en el dock de abajo 📍 */}
      {canCreate && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="btn-gradient-primary hidden lg:flex gap-1.5 rounded-sm" data-tour="create">
              <Plus className="h-4 w-4" />
              {t('Crear')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-md">
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
      )}

      {/* Theme toggle (claro/oscuro) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title="Modo claro/oscuro"
        className="rounded-full"
      >
        {mounted && theme === 'dark' ? (
          <Sun className="h-5 w-5 text-amber-400" />
        ) : (
          <Moon className="h-5 w-5 text-wine-400" />
        )}
      </Button>

      {/* Notifications */}
      {user && (
        <DropdownMenu open={notifOpen} onOpenChange={handleNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-full">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-wine-500 to-sepia-500 px-1 text-[10px] font-bold text-white live-pulse">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto custom-scroll rounded-md">
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
              notifications.slice(0, 20).map((n) => (
                <DropdownMenuItem key={n.id} className="flex items-start gap-2 py-2 rounded-lg">
                  <UserAvatar username={n.fromUser.username} avatar={n.fromUser.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.message}</p>
                    <TimeAgo date={n.createdAt} />
                  </div>
                  {n.type === 'LIVE' && (
                    <span className="rounded-full bg-gradient-to-r from-wine-500 to-sepia-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      LIVE
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* User menu / Login */}
      {user ? (
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full p-0.5 h-9 w-9"
            aria-label="Menú de usuario"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <UserAvatar username={user.username} avatar={user.avatar} size="sm" />
          </Button>
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-50 w-56 glass-strong rounded-md border border-border/50 shadow-lg overflow-hidden">
                <div className="p-3 border-b border-border/50">
                  <p className="font-semibold truncate text-sm">{user.username}</p>
                  {user.tags && user.tags.length > 0 ? (
                    <UserTags tags={user.tags} size="xs" max={2} className="mt-1" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {user.isGuest ? 'Invitado' : 'Miembro DevPlay'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { openProfile(user.id); setUserMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary/60 transition"
                >
                  <UserIcon className="h-4 w-4" />
                  Mi perfil
                </button>
                <button
                  onClick={() => { openSettings(); setUserMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary/60 transition"
                >
                  <Settings className="h-4 w-4" />
                  Configuración
                </button>
                <div className="border-t border-border/50" />
                <button
                  onClick={() => { handleSignOut(); setUserMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-secondary/60 transition"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <Button size="sm" onClick={() => openAuth('login')} className="btn-gradient-primary rounded-sm">
          Entrar
        </Button>
      )}

      {/* Search modal */}
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}
