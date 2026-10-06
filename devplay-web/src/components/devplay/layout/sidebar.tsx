'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Compass,
  Sparkles,
  MessageCircle,
  FileText,
  Gamepad2,
  Plus,
  X,
  Bookmark,
  Library,
  HelpCircle,
  Info,
  Award,
  Home,
  BarChart3,
  ShoppingBag,
  Settings2,
  RotateCcw,
  ClipboardList,
  Settings,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { UserAvatar, UserTags } from '@/components/devplay/shared/shared'
import type { ViewId } from '@/types/devplay'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface NavItem {
  id: ViewId
  label: string
  description: string
  icon: typeof Compass
  gradient: string
}

const MAIN_NAV: NavItem[] = [
  // Descubrir SIEMPRE arriba — nada la baja de la primera posición
  { id: 'discover', label: 'Descubrir', description: 'Novedades y trending', icon: Sparkles, gradient: 'from-wine-400 to-wine-500' },
  { id: 'explore', label: 'Inicio', description: 'Feed principal', icon: Home, gradient: 'from-wine-400 to-wine-500' },
  { id: 'betas', label: 'Betas', description: 'Centro de betas', icon: Gamepad2, gradient: 'from-amber-400 to-bronze-500' },
  { id: 'chat', label: 'Chat Mundial', description: 'Chatea con la comunidad', icon: MessageCircle, gradient: 'from-amber-400 to-bronze-500' },
  { id: 'store', label: 'Tienda', description: 'Power-ups, avatar y premium', icon: ShoppingBag, gradient: 'from-bronze-400 to-bronze-600' },
]

export function Sidebar() {
  const { t } = useT()
  const {
    currentView,
    setView,
    openProfile,
    openCreatePost,
    openCreateBeta,
    openCreatePoll,
    mobileSidebarOpen,
    closeMobileSidebar,
    onboardingDone,
    setOnboardingDone,
    startTour,
    openSettings,
  } = useUIStore()
  const { user, isAuthed, isGuest } = useCurrentUser()

  const canCreate = isAuthed && !isGuest

  const { sidebarCompact, hideHelp } = useUIStore()

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand en móvil */}
      <div className="flex items-center justify-between px-4 py-4 lg:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo-devplay.png" alt="DevPlay" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-display font-bold text-lg tracking-tight text-foreground">DevPlay</span>
        </div>
        <Button variant="ghost" size="icon" onClick={closeMobileSidebar} className="h-8 w-8 rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className={cn('flex-1 px-3 py-2 overflow-y-auto custom-scroll', sidebarCompact ? 'space-y-3' : 'space-y-4')}>
        {/* ===== Sección 1: Menú Principal (+ opciones del sidebar) ===== */}
        <div>
          <div className="flex items-center justify-between pr-1.5">
            <SectionTitle>{t('Menú principal')}</SectionTitle>
            <SidebarOptionsButton />
          </div>
          <div className="space-y-1">
            {MAIN_NAV.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={currentView === item.id}
                compact={sidebarCompact}
                onClick={() => setView(item.id)}
              />
            ))}
          </div>
        </div>

        {/* ===== Sección 2: Crear (logueados) ===== */}
        {canCreate && (
          <div>
            <SectionTitle>{t('Crear contenido')}</SectionTitle>
            <div className="space-y-1">
              <CreateButton icon={Gamepad2} label={t('Subir beta')} gradient="from-amber-400 to-bronze-500" compact={sidebarCompact} onClick={openCreateBeta} />
              <CreateButton icon={BarChart3} label={t('Crear encuesta')} gradient="from-olive-400 to-sepia-500" compact={sidebarCompact} onClick={openCreatePoll} />
            </div>
          </div>
        )}

        {/* ===== Sección 3: Biblioteca (logueados) ===== */}
        {canCreate && (
          <div>
            <SectionTitle>{t('Mi biblioteca')}</SectionTitle>
            <div className="space-y-1">
              <CreateButton icon={Bookmark} label={t('Guardados')} gradient="from-amber-400 to-bronze-500" compact={sidebarCompact} onClick={() => user && openProfile(user.id, 'favoritos')} />
              <CreateButton icon={Library} label={t('Mis betas')} gradient="from-wine-400 to-wine-500" compact={sidebarCompact} onClick={() => user && openProfile(user.id, 'publicaciones')} />
              <CreateButton icon={Award} label={t('Logros')} gradient="from-wine-400 to-bronze-500" compact={sidebarCompact} onClick={() => user && openProfile(user.id, 'logros')} />
              <CreateButton icon={ClipboardList} label={t('Reportes')} gradient="from-olive-400 to-sepia-500" compact={sidebarCompact} onClick={() => setView('reportes')} />
            </div>
          </div>
        )}

        {/* ===== Sección 4: Ayuda — ocultable ===== */}
        {!hideHelp && (
        <div>
          <SectionTitle>{t('Ayuda')}</SectionTitle>
          <div className="space-y-1">
            <CreateButton
              icon={HelpCircle}
              label={t('Tour guiado')}
              gradient="from-wine-400 to-bronze-500"
              compact={sidebarCompact}
              onClick={() => startTour()}
            />
            <CreateButton
              icon={Info}
              label={t('Acerca de DevPlay')}
              gradient="from-slate-400 to-gray-500"
              compact={sidebarCompact}
              onClick={() => setView('about')}
            />
          </div>
        </div>
        )}
      </nav>

      {/* Usuario abajo (+ rueda de configuración) */}
      {user && (
        <div className="border-t border-border/50 p-3 flex items-center gap-1">
          <button
            onClick={() => openProfile(user.id)}
            className="flex flex-1 min-w-0 items-center gap-3 rounded-md p-2 text-left hover:bg-secondary/60 transition"
          >
            <UserAvatar username={user.username} avatar={user.avatar} size="md" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.username}</span>
              {user.tags && user.tags.length > 0 ? (
                <UserTags tags={user.tags} size="xs" max={2} className="mt-0.5" />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {user.isGuest ? 'Modo invitado' : 'Ver perfil'}
                </p>
              )}
            </div>
          </button>
          <button
            onClick={openSettings}
            title="Configuración del perfil"
            aria-label="Configuración del perfil"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      <aside className="hidden lg:flex w-56 shrink-0 flex-col sticky top-16 h-[calc(100vh-4rem)] glass border-r border-border/50">
        {sidebarContent}
      </aside>

      <MobileDrawer
        open={mobileSidebarOpen}
        onClose={closeMobileSidebar}
        currentView={currentView}
        user={user}
        isAuthed={isAuthed}
        isGuest={isGuest}
        canCreate={canCreate}
        setView={setView}
        openProfile={openProfile}
        openCreatePost={openCreatePost}
        openCreateBeta={openCreateBeta}
        openCreatePoll={openCreatePoll}
        openAuth={useUIStore.getState().openAuth}
        setOnboardingDone={setOnboardingDone}
      />
    </>
  )
}

// ===== Drawer Móvil Rediseñado =====
interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  currentView: ViewId
  user: any
  isAuthed: boolean
  isGuest: boolean
  canCreate: boolean
  setView: (v: ViewId) => void
  openProfile: (id: string, tab?: string) => void
  openCreatePost: () => void
  openCreateBeta: () => void
  openCreatePoll: () => void
  openAuth: (mode?: 'login' | 'register') => void
  setOnboardingDone: (v: boolean) => void
}

function MobileDrawer({
  open, onClose, currentView, user, isAuthed, isGuest, canCreate,
  setView, openProfile,
  openCreatePost, openCreateBeta, openCreatePoll, openAuth, setOnboardingDone,
}: MobileDrawerProps) {
  const { t } = useT()

  function handleNav(view: ViewId) {
    setView(view)
    onClose()
  }

  const { hideHelp } = useUIStore()

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay con blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed left-0 top-0 z-50 flex h-full w-[88vw] max-w-sm flex-col glass-strong lg:hidden"
          >
            {/* Header con perfil destacado */}
            <div className="relative overflow-hidden border-b border-border/50">
              {/* Fondo gradiente */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />

              <div className="relative p-4 pb-3">
                {/* Logo + opciones + cerrar */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <img src="/logo-devplay.png" alt="DevPlay" className="h-8 w-8 rounded-lg object-cover" />
                    <span className="font-display font-bold text-lg tracking-tight text-foreground">DevPlay</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <SidebarOptionsButton />
                    <button
                      onClick={onClose}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary/60 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Perfil de usuario */}
                {user ? (
                  <button
                    onClick={() => { openProfile(user.id); onClose() }}
                    className="flex w-full items-center gap-3 rounded-lg bg-secondary/40 p-3 text-left hover:bg-secondary/60 transition"
                  >
                    <UserAvatar username={user.username} avatar={user.avatar} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{user.username}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {isGuest ? 'Modo invitado' : 'Ver mi perfil'}
                      </p>
                      {user.tags && user.tags.length > 0 && (
                        <UserTags tags={user.tags} size="xs" max={2} className="mt-1" />
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { openAuth('login'); onClose() }}
                      className="btn-gradient-primary flex-1 rounded-sm py-2 text-xs font-bold"
                    >
                      Entrar
                    </button>
                    <button
                      onClick={() => { openAuth('register'); onClose() }}
                      className="flex-1 rounded-full border border-border py-2 text-xs font-bold hover:bg-secondary/60 transition"
                    >
                      Crear cuenta
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto custom-scroll px-3 py-3 space-y-4">
              {/* Accesos rápidos — grid de 2x2 */}
              {canCreate && (
                <div>
                  <SectionTitle>{t('Crear')}</SectionTitle>
                  <div className="grid grid-cols-2 gap-2">
                    <QuickAction icon={FileText} label={t('Publicar')} gradient="from-wine-400 to-wine-500" onClick={() => { openCreatePost(); onClose() }} />
                    <QuickAction icon={Gamepad2} label={t('Beta')} gradient="from-amber-400 to-bronze-500" onClick={() => { openCreateBeta(); onClose() }} />
                    <QuickAction icon={BarChart3} label={t('Encuesta')} gradient="from-olive-400 to-sepia-500" onClick={() => { openCreatePoll(); onClose() }} />
                  </div>
                </div>
              )}

              {/* Navegación principal */}
              <div>
                <SectionTitle>{t('Navegación')}</SectionTitle>
                <div className="space-y-1">
                  {MAIN_NAV.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <MobileNavItem
                        item={item}
                        active={currentView === item.id}
                        onClick={() => handleNav(item.id)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Biblioteca */}
              {canCreate && (
                <div>
                  <SectionTitle>{t('Mi biblioteca')}</SectionTitle>
                  <div className="grid grid-cols-4 gap-2">
                    <LibraryMini icon={Bookmark} label={t('Guardados')} gradient="from-amber-400 to-bronze-500" onClick={() => { if (user) { openProfile(user.id, 'favoritos'); onClose() } }} />
                    <LibraryMini icon={Library} label={t('Mis betas')} gradient="from-wine-400 to-wine-500" onClick={() => { if (user) { openProfile(user.id, 'publicaciones'); onClose() } }} />
                    <LibraryMini icon={Award} label={t('Logros')} gradient="from-wine-400 to-bronze-500" onClick={() => { if (user) { openProfile(user.id, 'logros'); onClose() } }} />
                    <LibraryMini icon={ClipboardList} label={t('Reportes')} gradient="from-olive-400 to-sepia-500" onClick={() => { setView('reportes'); onClose() }} />
                  </div>
                </div>
              )}

              {/* Ayuda — ocultable desde opciones */}
              {!hideHelp && (
              <div>
                <SectionTitle>{t('Ayuda')}</SectionTitle>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      onClose()
                      useUIStore.getState().startTour()
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-secondary/60 transition"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary from-wine-400 to-bronze-500">
                      <HelpCircle className="h-4 w-4" />
                    </span>
                    <span className="font-semibold text-sm">{t('Tour guiado')}</span>
                  </button>
                  <button
                    onClick={() => { setView('about'); onClose() }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-secondary/60 transition"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary from-slate-400 to-gray-500">
                      <Info className="h-4 w-4" />
                    </span>
                    <span className="font-semibold text-sm">{t('Acerca de')}</span>
                  </button>
                </div>
              </div>
              )}
            </div>

            {/* Footer — CTA para invitados */}
            {!canCreate && (
              <div className="border-t border-border/50 p-3">
                <button
                  onClick={() => { openAuth('register'); onClose() }}
                  className="btn-gradient-primary w-full rounded-sm py-2.5 text-xs font-bold"
                >
                  Crear cuenta gratis
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// ===== Item de navegación móvil (más grande y claro) =====
function MobileNavItem({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const { t } = useT()
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-all',
        active
          ? 'nav-active shadow-sm'
          : 'hover:bg-secondary/60 text-foreground/90 hover:text-foreground'
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition',
          active ? 'bg-primary-foreground/25 text-primary-foreground' : 'bg-primary/10 text-primary',
          !active && 'opacity-80 group-hover:opacity-100'
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate font-semibold text-sm">{t(item.label)}</div>
        <div className={cn('truncate text-[11px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{t(item.description)}</div>
      </div>
      {active && (
        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  )
}

// ===== Acción rápida (grid 2x2) =====
function QuickAction({ icon: Icon, label, gradient, onClick }: { icon: typeof Plus; label: string; gradient: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-md bg-secondary/40 p-3 hover:bg-secondary/70 transition"
    >
      <span className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm transition group-hover:scale-110',
        gradient
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  )
}

// ===== Biblioteca mini (grid 3 cols) =====
function LibraryMini({ icon: Icon, label, gradient, onClick }: { icon: typeof Plus; label: string; gradient: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1 rounded-md bg-secondary/40 p-2.5 hover:bg-secondary/70 transition"
    >
      <span className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white transition group-hover:scale-110',
        gradient
      )}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="label-caps flex items-center gap-2 px-3 pb-1.5 pt-1">
      <span className="inline-block h-px w-3 bg-wine-500/70" />
      {children}
    </p>
  )
}

function NavButton({ item, active, onClick, compact }: { item: NavItem; active: boolean; onClick: () => void; compact?: boolean }) {
  const { t } = useT()
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-all',
        compact ? 'py-1.5' : 'py-2.5',
        active
          ? 'nav-active shadow-sm'
          : 'hover:bg-secondary/60 text-foreground/90 hover:text-foreground'
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg transition',
          compact ? 'h-7 w-7' : 'h-9 w-9',
          active ? 'bg-primary-foreground/25 text-primary-foreground' : 'bg-primary/10 text-primary',
          !active && 'opacity-80 group-hover:opacity-100'
        )}
      >
        <Icon className={compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate font-semibold">{t(item.label)}</div>
        {!compact && (
          <div className={cn('truncate text-[11px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {t(item.description)}
          </div>
        )}
      </div>
    </button>
  )
}

function CreateButton({
  icon: Icon,
  label,
  gradient,
  onClick,
  compact,
}: {
  icon: typeof Plus
  label: string
  gradient: string
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-secondary/60 transition',
        compact ? 'py-1' : 'py-2'
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition',
          compact ? 'h-7 w-7' : 'h-8 w-8',
          gradient
        )}
      >
        <Icon className={compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} />
      </span>
      <span className="font-semibold text-sm">{label}</span>
    </button>
  )
}

// ===== Botón de opciones del sidebar (⋯) =====
function SidebarOptionsButton() {
  const { t } = useT()
  const {
    sidebarCompact, setSidebarCompact,
    hideHelp, setHideHelp,
    resetSidebarPrefs,
  } = useUIStore()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title={t('Opciones del sidebar')}
          aria-label={t('Opciones del sidebar')}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-md">
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
          <Settings2 className="h-3 w-3" />
          {t('Opciones del sidebar')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={sidebarCompact}
          onCheckedChange={(v) => setSidebarCompact(v === true)}
          onSelect={(e) => e.preventDefault()}
          className="gap-2 rounded-lg text-xs"
        >
          {t('Modo compacto')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hideHelp}
          onCheckedChange={(v) => setHideHelp(v === true)}
          onSelect={(e) => e.preventDefault()}
          className="gap-2 rounded-lg text-xs"
        >
          {t('Ocultar sección Ayuda')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            resetSidebarPrefs()
            toast.success(t('Sidebar restablecido'))
          }}
          className="gap-2 rounded-lg text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('Restablecer todo')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
