'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { userService, followService, uploadService, postService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { toast } from 'sonner'
import {
  UserAvatar, TimeAgo, UserTags,
} from '@/components/devplay/shared/shared'
import { PostCard } from '@/components/devplay/post/post-card'
import {
  Settings, ArrowLeft, Loader2, Camera, Check,
  Users, Heart, Gamepad2, FileText, Download, Award, TrendingUp,
  Calendar, Sparkles, Bookmark, BarChart3, Home, Activity,
  Share2, Star, MapPin, Globe, Briefcase, Cake,
  Image as ImageIcon, Video, Info, Shield, Ban,
  User as UserIcon, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PREDEFINED_TAGS, SOCIAL_PLATFORMS } from '@/types/devplay'
import type { SocialLinks } from '@/types/devplay'
import { ThemeSwitcher } from '@/components/devplay/layout/theme-switcher'
import { SecurityPanel } from '@/components/devplay/views/security-panel'
import { BlockConfirmDialog, UnblockConfirmDialog } from '@/components/devplay/modals/block-confirm-dialog'
import { securityService } from '@/services/security-service'
import { ShareProfileModal } from '@/components/devplay/modals/share-profile-modal'

type ProfileTab = 'inicio' | 'informacion' | 'publicaciones' | 'fotos' | 'favoritos' | 'compartidos' | 'logros' | 'estadisticas' | 'seguridad'

export function ProfileView({ userId }: { userId: string }) {
  const { user: me, isAuthed, isGuest, refresh } = useCurrentUser()
  const { setView, openAuth, openPostDetail, profileTab, openDM } = useUIStore()
  const [editing, setEditing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    (profileTab as ProfileTab) || 'inicio'
  )
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showUnblockDialog, setShowUnblockDialog] = useState(false)
  const [showShare, setShowShare] = useState(false)

  // Si cambia profileTab desde el store, actualizar
  useEffect(() => {
    if (profileTab) {
      setActiveTab(profileTab as ProfileTab)
    }
  }, [profileTab])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => userService.get(userId),
    enabled: !!userId,
  })

  const isMe = me?.id === userId
  const canFollow = isAuthed && !isGuest && !isMe

  async function handleFollow() {
    if (!canFollow) { openAuth('login'); return }
    setFollowLoading(true)
    try {
      if (data!.user.isFollowing) await followService.unfollow(userId)
      else await followService.follow(userId)
      refetch()
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setFollowLoading(false)
    }
  }

  async function handleShare() {
    setShowShare(true)
  }

  if (isLoading || !data) return <ProfileSkeleton />

  const { user, posts = [] } = data
  const betaPosts = posts.filter((p) => p.type === 'BETA')
  const normalPosts = posts.filter((p) => p.type !== 'BETA')
  const photoPosts = posts.filter((p) => p.mediaUrls.some(m => m.kind === 'image'))
  const videoPosts = posts.filter((p) => p.mediaUrls.some(m => m.kind === 'video'))

  const availableTabs: { id: ProfileTab; label: string; icon: any }[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'informacion', label: 'Información', icon: Info },
    { id: 'publicaciones', label: 'Publicaciones', icon: FileText },
    { id: 'fotos', label: 'Fotos', icon: ImageIcon },
    { id: 'compartidos', label: 'Compartidos', icon: Share2 },
  ]
  // Privacidad: favoritos, logros y estadísticas solo para el propio usuario
  if (isMe) {
    availableTabs.push(
      { id: 'favoritos', label: 'Favoritos', icon: Bookmark },
      { id: 'logros', label: 'Logros', icon: Award },
      { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
      { id: 'seguridad', label: 'Seguridad', icon: Shield }
    )
  }

  // Redes sociales del usuario
  const socialLinks = user.socialLinks || {}
  const activeSocials = SOCIAL_PLATFORMS.filter(p => socialLinks[p.key])

  return (
    <div className="space-y-4 pb-8">
      <Button variant="ghost" size="sm" onClick={() => setView('explore')} className="gap-1 rounded-full">
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      {/* ===== HEADER (25-35% del screen) ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        {/* Banner editable */}
        <div className="h-32 sm:h-44 md:h-52 relative overflow-hidden group">
          <div className="absolute inset-0 banner-gradient" />
          <img
            src={user.banner || '/uploads/default-banner.png'}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {isMe && (
            <button
              onClick={() => setEditing(true)}
              className="absolute top-2 right-2 z-20 rounded-full bg-black/50 backdrop-blur p-2 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/70"
              aria-label="Cambiar portada"
            >
              <Camera className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-4 -mt-12 sm:-mt-16 relative z-10">
          <div className="flex items-end justify-between gap-3">
            <div className="relative group">
              <UserAvatar
                username={user.username}
                avatar={user.avatar}
                size="xl"
                className="ring-4 ring-background shrink-0"
              />
              {isMe && (
                <button
                  onClick={() => setEditing(true)}
                  className="absolute -bottom-1 -right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition"
                  aria-label="Cambiar foto"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2 mb-1">
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 rounded-full">
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Compartir</span>
              </Button>
              {isMe && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5 rounded-full">
                  <Settings className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>
              )}
              {canFollow && (
                <Button
                  size="sm"
                  onClick={handleFollow}
                  disabled={followLoading || user.isBlocked}
                  variant={user.isFollowing ? 'outline' : 'default'}
                  className={cn('gap-1.5 rounded-sm', !user.isFollowing && 'btn-gradient-primary')}
                >
                  {user.isFollowing ? 'Siguiendo' : 'Seguir'}
                </Button>
              )}
              {canFollow && !user.isBlocked && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openDM(user.id)}
                  className="gap-1.5 rounded-full"
                  title="Mensaje privado"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mensaje</span>
                </Button>
              )}
              {canFollow && !user.isBlocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBlockDialog(true)}
                  className="gap-1.5 rounded-full text-muted-foreground hover:text-red-500"
                  title="Bloquear usuario"
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              )}
              {canFollow && user.isBlocked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUnblockDialog(true)}
                  className="gap-1.5 rounded-full text-red-500 border-red-500/30"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Desbloquear</span>
                </Button>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{user.fullName || user.username}</h1>
              {user.isGuest && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">Invitado</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{user.username}</p>

            {/* Contadores visibles: seguidores · seguidos · publicaciones */}
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3.5 py-1.5 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-wine-500" />
                <b className="text-foreground">{user.followersCount}</b>
                <span className="text-muted-foreground">seguidores</span>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>
                <b className="text-foreground">{user.followingCount}</b>
                <span className="text-muted-foreground"> seguidos</span>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>
                <b className="text-foreground">{posts.length}</b>
                <span className="text-muted-foreground"> publicaciones</span>
              </span>
            </div>

            {/* Tags */}
            {user.tags && user.tags.length > 0 && (
              <UserTags tags={user.tags} size="sm" max={8} className="mt-2" />
            )}

            {/* Bio */}
            {user.bio && (
              <p className="text-sm text-foreground/80 mt-2 leading-relaxed whitespace-pre-wrap">{user.bio}</p>
            )}

            {/* Metadata: ubicación, web, profesión, fecha registro */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              {user.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {user.location}
                </span>
              )}
              {user.profession && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {user.profession}
                </span>
              )}
              {user.website && (
                <a
                  href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-3 w-3" />
                  {user.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Se unió <TimeAgo date={user.createdAt} />
              </span>
            </div>

            {/* Redes sociales */}
            {activeSocials.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {activeSocials.map((p) => (
                  <a
                    key={p.key}
                    href={socialLinks[p.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={p.label}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white text-sm transition shadow-sm',
                      p.color
                    )}
                  >
                    {p.emoji}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ===== TABS ===== */}
      <div className="glass-card p-1.5 flex gap-1 overflow-x-auto custom-scroll rounded-full">
        {availableTabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-all whitespace-nowrap',
                active ? 'btn-gradient-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ===== CONTENIDO ===== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'inicio' && (
            <ProfileInicio betaPosts={betaPosts} normalPosts={normalPosts} isMe={isMe} onPostClick={openPostDetail} />
          )}
          {activeTab === 'informacion' && (
            <ProfileInformacion user={user} isMe={isMe} />
          )}
          {activeTab === 'publicaciones' && (
            <ProfilePublicaciones posts={posts} isMe={isMe} />
          )}
          {activeTab === 'fotos' && (
            <ProfileFotos posts={photoPosts} videoPosts={videoPosts} onPostClick={openPostDetail} />
          )}
          {activeTab === 'favoritos' && isMe && <ProfileFavoritos />}
          {activeTab === 'compartidos' && <ProfileCompartidos posts={posts} isMe={isMe} />}
          {activeTab === 'logros' && <ProfileLogros userId={userId} />}
          {activeTab === 'estadisticas' && <ProfileEstadisticas userId={userId} />}
          {activeTab === 'seguridad' && isMe && <SecurityPanel />}
        </motion.div>
      </AnimatePresence>

      {/* ===== MODAL EDITAR ===== */}
      {editing && isMe && (
        <EditProfileDialog
          open={editing}
          onClose={() => setEditing(false)}
          user={user}
          onSaved={async () => {
            await refresh()
            refetch()
            setEditing(false)
          }}
        />
      )}

      {/* ===== MODAL COMPARTIR (múltiples opciones) ===== */}
      <ShareProfileModal
        open={showShare}
        onClose={() => setShowShare(false)}
        username={user.username}
      />

      {/* ===== MODAL BLOQUEAR ===== */}
      <BlockConfirmDialog
        open={showBlockDialog}
        onClose={() => setShowBlockDialog(false)}
        userId={user.id}
        username={user.username}
        avatar={user.avatar}
        onBlocked={() => refetch()}
      />

      {/* ===== MODAL DESBLOQUEAR ===== */}
      <UnblockConfirmDialog
        open={showUnblockDialog}
        onClose={() => setShowUnblockDialog(false)}
        userId={user.id}
        username={user.username}
        avatar={user.avatar}
        onUnblocked={() => refetch()}
      />
    </div>
  )
}

// ===== STATS (dentro de la pestaña Información) =====
function ProfileStats({ userId }: { userId: string }) {
  const isMe = useCurrentUser().user?.id === userId
  const { data, isLoading } = useQuery({
    queryKey: ['user-stats', userId],
    queryFn: () => isMe ? postService.getStats() : null,
    enabled: isMe,
  })

  const { data: profileData } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => userService.get(userId),
    enabled: !isMe,
  })

  const stats = isMe ? data?.stats : null
  const u = profileData?.user

  const rows = isMe && stats ? [
    { icon: FileText, label: 'Posts', value: stats.posts, gradient: 'from-wine-400 to-wine-500' },
    { icon: Users, label: 'Seguidores', value: stats.followers, gradient: 'from-wine-500 to-wine-700' },
    { icon: Users, label: 'Siguiendo', value: stats.following, gradient: 'from-olive-400 to-sepia-500' },
    { icon: Gamepad2, label: 'Betas', value: stats.betas, gradient: 'from-amber-400 to-bronze-500' },
    { icon: Download, label: 'Descargas', value: stats.totalDownloads, gradient: 'from-bronze-400 to-bronze-600' },
    { icon: Heart, label: 'Likes recibidos', value: stats.totalLikesReceived, gradient: 'from-wine-400 to-sepia-500' },
  ] : u ? [
    { icon: FileText, label: 'Posts', value: u.postsCount, gradient: 'from-wine-400 to-wine-500' },
    { icon: Users, label: 'Seguidores', value: u.followersCount, gradient: 'from-wine-500 to-wine-700' },
    { icon: Users, label: 'Siguiendo', value: u.followingCount, gradient: 'from-olive-400 to-sepia-500' },
  ] : []

  if (isLoading) {
    return (
      <div className="glass-card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      </div>
    )
  }

  if (rows.length === 0) return null

  return (
    <div className="glass-card p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
        <Activity className="h-4 w-4 text-primary" />
        Actividad en números
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rows.map((row, i) => {
          const Icon = row.icon
          return (
            <div key={row.label} className="flex items-center gap-2 rounded-md glass p-2">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm', row.gradient)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-none">{row.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{row.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 800
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      setDisplay(Math.floor(value * progress))
      if (progress >= 1) clearInterval(interval)
    }, 16)
    return () => clearInterval(interval)
  }, [value])
  return <div className="text-lg font-bold">{display}</div>
}

// ===== TAB: INICIO =====
function ProfileInicio({ betaPosts, normalPosts, isMe, onPostClick }: any) {
  const totalDownloads = betaPosts.reduce((sum: number, p: any) => sum + (p.beta?.downloads ?? 0), 0)
  const totalLikes = betaPosts.reduce((sum: number, p: any) => sum + p.likesCount, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card card-peach p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Juegos</span>
          </div>
          <p className="text-2xl font-bold">{betaPosts.length}</p>
          <p className="text-xs text-muted-foreground">{totalDownloads} descargas totales</p>
        </div>
        <div className="glass-card card-lavender p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-wine-500" />
            <span className="text-sm font-semibold">Publicaciones</span>
          </div>
          <p className="text-2xl font-bold">{normalPosts.length}</p>
          <p className="text-xs text-muted-foreground">{totalLikes} likes totales</p>
        </div>
      </div>

      {betaPosts.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2 px-1">Juegos recientes</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {betaPosts.slice(0, 6).map((post: any) => (
              <button
                key={post.id}
                onClick={() => onPostClick(post.id)}
                className="glass-card text-left overflow-hidden transition"
              >
                <div className="aspect-video bg-gradient-to-br from-amber-300 to-bronze-400 relative">
                  {post.beta?.coverImage && (
                    <img src={post.beta.coverImage} alt="" className="w-full h-full object-contain p-2" />
                  )}
                  <div className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] text-white font-bold">
                    {post.beta?.downloads ?? 0} ⬇
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold truncate">{post.beta?.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">@{post.author.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {normalPosts.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2 px-1">📝 Publicaciones recientes</h3>
          <div className="space-y-3">
            {normalPosts.slice(0, 3).map((post: any) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}

      {betaPosts.length === 0 && normalPosts.length === 0 && (
        <div className="glass-card p-8 text-center">
          <Sparkles className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">{isMe ? '¡Empieza a crear contenido!' : 'Sin contenido aún'}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isMe ? 'Sube tu primera beta o publica algo para la comunidad' : 'Cuando este usuario publique algo, aparecerá aquí'}
          </p>
        </div>
      )}
    </div>
  )
}

// ===== TAB: INFORMACIÓN =====
function ProfileInformacion({ user, isMe }: { user: any; isMe: boolean }) {
  const socialLinks = user.socialLinks || {}
  const activeSocials = SOCIAL_PLATFORMS.filter(p => socialLinks[p.key])
  const infoItems = [
    user.fullName && { icon: UserIcon, label: 'Nombre completo', value: user.fullName },
    user.profession && { icon: Briefcase, label: 'Profesión', value: user.profession },
    user.location && { icon: MapPin, label: 'Ubicación', value: user.location },
    user.birthDate && { icon: Cake, label: 'Cumpleaños', value: new Date(user.birthDate).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) },
    user.createdAt && { icon: Calendar, label: 'Fecha de registro', value: new Date(user.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) },
    user.lastSeen && { icon: Globe, label: 'Última conexión', value: <TimeAgo date={user.lastSeen} /> },
  ].filter(Boolean) as { icon: any; label: string; value: any }[]

  return (
    <div className="space-y-4">
      {/* Actividad en números (antes estaba en la cabecera del perfil) */}
      <ProfileStats userId={user.id} />

      {/* Información personal */}
      <div className="glass-card p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
          <Info className="h-4 w-4 text-primary" />
          Información personal
        </h3>
        {infoItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin información personal</p>
        ) : (
          <div className="space-y-2.5">
            {infoItems.map((item: any, i) => (
              <div key={i} className="flex items-center gap-3">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Biografía */}
      {user.bio && (
        <div className="glass-card p-4">
          <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" />
            Biografía
          </h3>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{user.bio}</p>
        </div>
      )}

      {/* Redes sociales */}
      {activeSocials.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-primary" />
            Redes sociales
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeSocials.map((p) => (
              <a
                key={p.key}
                href={socialLinks[p.key]}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-md glass p-2.5 transition"
              >
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white text-sm', p.color)}>
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{socialLinks[p.key]}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {user.tags && user.tags.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            Intereses / Tags
          </h3>
          <UserTags tags={user.tags} size="sm" max={30} />
        </div>
      )}

      {/* Apariencia (solo propio usuario) */}
      {isMe && <ThemeSwitcher />}
    </div>
  )
}

// ===== TAB: PUBLICACIONES =====
function ProfilePublicaciones({ posts, isMe }: any) {
  if (posts.length === 0) {
    return <EmptyState icon={FileText} title="Sin publicaciones" desc={isMe ? 'Publica algo para la comunidad' : 'Aún no ha publicado nada'} />
  }
  return (
    <div className="space-y-3">
      {posts.map((post: any) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

// ===== TAB: FOTOS =====
function ProfileFotos({ posts, videoPosts, onPostClick }: any) {
  const allMedia: { url: string; kind: 'image' | 'video'; postId: string }[] = []
  posts.forEach((p: any) => {
    p.mediaUrls.forEach((m: any) => {
      allMedia.push({ url: m.url, kind: m.kind, postId: p.id })
    })
  })

  if (allMedia.length === 0 && videoPosts.length === 0) {
    return <EmptyState icon={ImageIcon} title="Sin fotos" desc="Las imágenes compartidas aparecerán aquí" />
  }

  return (
    <div className="space-y-4">
      {allMedia.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2 px-1">📸 Fotos ({allMedia.length})</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {allMedia.map((m, i) => (
              <button
                key={i}
                onClick={() => onPostClick(m.postId)}
                className="aspect-square rounded-lg overflow-hidden glass transition"
              >
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== TAB: COMPARTIDOS (reposts) =====
function ProfileCompartidos({ posts, isMe }: { posts: any[]; isMe: boolean }) {
  // Filtrar solo los reposts (posts que tienen repostOf)
  const reposts = posts.filter((p) => p.repostOf)

  if (reposts.length === 0) {
    return (
      <EmptyState
        icon={Share2}
        title="Sin compartidos"
        desc={isMe ? 'Repostea publicaciones para verlas aquí' : 'Aún no ha compartido nada'}
      />
    )
  }

  return (
    <div className="space-y-3">
      {reposts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

// ===== TAB: FAVORITOS =====
function ProfileFavoritos() {
  const { data, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => postService.getBookmarks(),
  })

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}</div>

  const posts = data?.posts ?? []
  if (posts.length === 0) {
    return <EmptyState icon={Bookmark} title="Sin favoritos" desc="Guarda publicaciones para verlas aquí" />
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onChange={() => {}} />
      ))}
    </div>
  )
}

// ===== TAB: LOGROS =====
function ProfileLogros({ userId }: { userId: string }) {
  const isMe = useCurrentUser().user?.id === userId
  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => isMe ? postService.getAchievements() : null,
    enabled: isMe,
  })

  if (!isMe) return <EmptyState icon={Award} title="Logros privados" desc="Los logros detallados solo son visibles para el propio usuario" />
  if (isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28 rounded-md" />)}</div>

  const achievements = data?.achievements ?? []
  const unlocked = data?.totalUnlocked ?? 0
  const total = data?.total ?? 0

  const tierColors: Record<string, string> = {
    bronze: 'from-bronze-300 to-amber-500',
    silver: 'from-gray-300 to-gray-500',
    gold: 'from-yellow-300 to-amber-500',
    platinum: 'from-bronze-300 to-wine-500',
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-bronze-500 text-white">
          <Award className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{unlocked} de {total} logros desbloqueados</p>
          <div className="h-2 w-full bg-secondary rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-bronze-500 transition-all" style={{ width: `${(unlocked / total) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {achievements.map((a: any, i: number) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className={cn('glass-card p-3 text-center relative', !a.unlocked && 'opacity-50 grayscale')}
          >
            {a.unlocked && (
              <div className="absolute top-1 right-1">
                <Check className="h-3.5 w-3.5 text-olive-500" />
              </div>
            )}
            <div className={cn('mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full text-2xl', a.unlocked ? `bg-gradient-to-br ${tierColors[a.tier]}` : 'bg-secondary')}>
              {a.emoji}
            </div>
            <p className="text-xs font-bold truncate">{a.label}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{a.description}</p>
            {!a.unlocked && (
              <div className="mt-1.5">
                <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60" style={{ width: `${(a.progress / a.target) * 100}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{a.progress}/{a.target}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ===== TAB: ESTADÍSTICAS =====
function ProfileEstadisticas({ userId }: { userId: string }) {
  const isMe = useCurrentUser().user?.id === userId
  const { data, isLoading } = useQuery({
    queryKey: ['user-stats-view', userId],
    queryFn: () => isMe ? postService.getStats() : null,
    enabled: isMe,
  })

  if (!isMe) return <EmptyState icon={BarChart3} title="Estadísticas privadas" desc="Las estadísticas detalladas solo son visibles para el propio usuario" />
  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-md" />)}</div>

  const stats = data?.stats
  if (!stats) return null

  const maxActivity = Math.max(...stats.activityByDay.map((d: any) => d.count), 1)
  const weekTotal = stats.activityByDay.reduce((sum: number, d: any) => sum + d.count, 0)

  // Indicadores inteligentes
  const insights: { icon: any; text: string; color: string }[] = []
  if (stats.totalDownloads > 0) {
    insights.push({ icon: Download, text: `Tus betas han sido descargadas ${stats.totalDownloads} veces en total`, color: 'from-amber-400 to-bronze-500' })
  }
  if (stats.totalLikesReceived > 0) {
    insights.push({ icon: Heart, text: `Has recibido ${stats.totalLikesReceived} likes en todas tus publicaciones`, color: 'from-wine-500 to-wine-700' })
  }
  if (stats.followers > 0) {
    insights.push({ icon: Users, text: `Tienes ${stats.followers} seguidores que reciben tus actualizaciones`, color: 'from-wine-400 to-wine-500' })
  }
  if (stats.betas > 0) {
    insights.push({ icon: Gamepad2, text: `Has publicado ${stats.betas} beta(s) para la comunidad`, color: 'from-olive-400 to-sepia-500' })
  }
  if (weekTotal > 0) {
    insights.push({ icon: TrendingUp, text: `Has publicado ${weekTotal} veces esta semana`, color: 'from-wine-400 to-wine-500' })
  }

  return (
    <div className="space-y-4">
      {/* ===== Resumen visual (Estado de la cuenta) ===== */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-wine-400 to-wine-500 text-white">
            <BarChart3 className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold">Estado de la cuenta</h3>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center glass rounded-lg p-2">
            <Users className="h-4 w-4 mx-auto text-wine-500" />
            <p className="text-lg font-bold mt-0.5">{stats.followers}</p>
            <p className="text-[9px] text-muted-foreground">Seguidores</p>
          </div>
          <div className="text-center glass rounded-lg p-2">
            <Download className="h-4 w-4 mx-auto text-amber-500" />
            <p className="text-lg font-bold mt-0.5">{stats.totalDownloads}</p>
            <p className="text-[9px] text-muted-foreground">Descargas</p>
          </div>
          <div className="text-center glass rounded-lg p-2">
            <Heart className="h-4 w-4 mx-auto text-wine-500" />
            <p className="text-lg font-bold mt-0.5">{stats.totalLikesReceived}</p>
            <p className="text-[9px] text-muted-foreground">Likes</p>
          </div>
        </div>
      </div>

      {/* ===== Indicadores inteligentes ===== */}
      {insights.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            Resumen de tu actividad
          </h3>
          <div className="space-y-2">
            {insights.map((insight, i) => {
              const Icon = insight.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 glass rounded-lg p-2.5"
                >
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white', insight.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs text-foreground/80">{insight.text}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== Grid de stats detalladas ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox icon={FileText} label="Publicaciones" value={stats.posts} color="from-wine-400 to-wine-500" />
        <StatBox icon={Gamepad2} label="Betas" value={stats.betas} color="from-amber-400 to-bronze-500" />
        <StatBox icon={Download} label="Descargas" value={stats.totalDownloads} color="from-olive-400 to-sepia-500" />
        <StatBox icon={Heart} label="Likes recibidos" value={stats.totalLikesReceived} color="from-wine-500 to-wine-700" />
        <StatBox icon={Users} label="Seguidores" value={stats.followers} color="from-wine-400 to-wine-500" />
        <StatBox icon={Users} label="Siguiendo" value={stats.following} color="from-olive-400 to-sepia-500" />
        <StatBox icon={FileText} label="Comentarios" value={stats.comments} color="from-wine-400 to-wine-500" />
        <StatBox icon={Bookmark} label="Guardados" value={stats.bookmarks} color="from-amber-400 to-bronze-500" />
      </div>

      {/* ===== Gráfica de actividad ===== */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          Actividad (últimos 7 días)
        </h3>
        <div className="flex items-end justify-between gap-1.5 h-32">
          {stats.activityByDay.map((day: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex-1 flex items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.count / maxActivity) * 100}%` }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className={cn('w-full rounded-t-md', day.count > 0 ? 'bg-gradient-to-t from-primary to-primary/60' : 'bg-secondary')}
                  style={{ minHeight: '4px' }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">
                {new Date(day.date).toLocaleDateString('es', { weekday: 'short' }).charAt(0)}
              </span>
              <span className="text-[9px] font-bold">{day.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatBox({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="glass-card p-3 flex items-center gap-2">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  )
}

// ===== EMPTY STATE =====
function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="glass-card p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  )
}

// ===== SKELETON =====
function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-24 rounded-full" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  )
}

// ===== EDIT PROFILE DIALOG (completo) =====
function EditProfileDialog({ open, onClose, user, onSaved }: any) {
  const { refresh } = useCurrentUser()
  const [bio, setBio] = useState(user.bio ?? '')
  const [avatar, setAvatar] = useState(user.avatar ?? '')
  const [banner, setBanner] = useState(user.banner ?? '/uploads/default-banner.png')
  const [fullName, setFullName] = useState(user.fullName ?? '')
  const [location, setLocation] = useState(user.location ?? '')
  const [website, setWebsite] = useState(user.website ?? '')
  const [profession, setProfession] = useState(user.profession ?? '')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(user.socialLinks || {})
  const [selectedTags, setSelectedTags] = useState<string[]>(user.tags ?? [])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [saving, setSaving] = useState(false)

  function toggleTag(id: string) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter(t => t !== id) : prev.length < 8 ? [...prev, id] : prev
    )
  }

  function updateSocial(key: keyof SocialLinks, value: string) {
    setSocialLinks((prev) => ({ ...prev, [key]: value || undefined }))
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') {
    const f = e.target.files?.[0]
    if (!f) return
    if (type === 'avatar') setUploadingAvatar(true)
    else setUploadingBanner(true)
    try {
      const res = await uploadService.upload(f, 'avatar')
      if (type === 'avatar') setAvatar(res.url)
      else setBanner(res.url)
      toast.success(type === 'avatar' ? 'Foto de perfil actualizada' : 'Portada actualizada')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      if (type === 'avatar') setUploadingAvatar(false)
      else setUploadingBanner(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await userService.updateProfile({
        bio: bio.trim() || null,
        avatar: avatar || null,
        banner: banner || null,
        fullName: fullName.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        profession: profession.trim() || null,
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
        tags: selectedTags,
      })
      await refresh()
      toast.success('Perfil actualizado')
      onSaved()
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="glass-strong w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scroll rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con preview de portada + avatar */}
        <div className="relative">
          {/* Banner */}
          <div className="h-28 relative group overflow-hidden rounded-t-2xl">
            {banner ? (
              <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 w-full h-full banner-gradient" />
            )}
            <label className="absolute top-2 right-2 z-20 cursor-pointer rounded-full bg-black/50 backdrop-blur p-2 text-white hover:bg-black/70 transition">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'banner')} />
              {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </label>
          </div>
          {/* Avatar */}
          <div className="px-5 -mt-10 relative z-10 flex items-end justify-between">
            <div className="relative">
              <UserAvatar username={user.username} avatar={avatar} size="lg" className="ring-4 ring-background" />
              <label className="absolute -bottom-1 -right-1 cursor-pointer flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'avatar')} />
                {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </label>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-lg font-bold">Editar perfil</h2>

          {/* Información básica */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Información básica</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Nombre completo</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={100}
                  className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Profesión</label>
                <input
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="Ej: Game Designer"
                  maxLength={100}
                  className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Ubicación</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ciudad, País"
                maxLength={100}
                className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Sitio web</label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://tusitio.com"
                maxLength={200}
                className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Biografía */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Biografía</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Cuéntanos sobre ti, soy...&#10;&#10;...&#10;&#10;..."
              maxLength={500}
              rows={4}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground text-right">{bio.length}/500</p>
          </div>

          {/* Redes sociales */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Redes sociales</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SOCIAL_PLATFORMS.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white text-sm', p.color)}>
                    {p.emoji}
                  </span>
                  <input
                    value={socialLinks[p.key] || ''}
                    onChange={(e) => updateSocial(p.key, e.target.value)}
                    placeholder={p.label}
                    className="flex-1 min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">🏷️ Mis tags</label>
              <span className="text-[11px] text-muted-foreground">{selectedTags.length}/8</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto custom-scroll p-1">
              {PREDEFINED_TAGS.map((tag) => {
                const active = selectedTags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                      active
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-secondary/60 text-secondary-foreground hover:border-primary/40'
                    )}
                  >
                    <span>{tag.label}</span>
                    {active && <Check className="h-3 w-3" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 p-4 border-t border-border/50 bg-background/80 backdrop-blur">
          <Button variant="outline" onClick={onClose} className="rounded-full flex-1">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="btn-gradient-primary rounded-sm flex-1">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar cambios'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
