'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { postService, userService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { cn } from '@/lib/utils'
import {
  ClipboardList, FileText, Gamepad2, Download, Heart, Users, MessageSquare,
  TrendingUp, Star, LogIn, Flame,
} from 'lucide-react'

/**
 * Vista "Reportes" — resumen de actividad de tu cuenta:
 * Actividad personal: resumen de tu cuenta, actividad semanal y tus
 * publicaciones más queridas.
 */
export function ReportsView() {
  const { user, isAuthed, isGuest } = useCurrentUser()
  const openAuth = useUIStore((s) => s.openAuth)
  const openPostDetail = useUIStore((s) => s.openPostDetail)

  const enabled = !!user && isAuthed && !isGuest

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['reports-stats', user?.id],
    queryFn: () => postService.getStats(),
    enabled,
  })

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['reports-profile', user?.id],
    queryFn: () => userService.get(user!.id),
    enabled,
  })

  if (!isAuthed || (isAuthed && isGuest)) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-secondary">
          <ClipboardList className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-semibold">Tus reportes te esperan</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Entra con tu cuenta para ver el resumen de tu actividad: publicaciones, descargas, likes y más.
        </p>
        <Button onClick={() => openAuth('login')} className="btn-gradient-primary rounded-sm gap-1.5">
          <LogIn className="h-4 w-4" />
          Entrar
        </Button>
      </div>
    )
  }

  const stats = statsData?.stats
  const posts = (profileData?.posts ?? []) as any[]
  const topPosts = [...posts]
    .sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
    .slice(0, 5)

  const maxActivity = stats ? Math.max(...stats.activityByDay.map((d: any) => d.count), 1) : 1
  const weekTotal = stats ? stats.activityByDay.reduce((sum: number, d: any) => sum + d.count, 0) : 0

  const cards = stats ? [
    { icon: FileText, label: 'Publicaciones', value: stats.posts, gradient: 'from-wine-400 to-wine-500' },
    { icon: Gamepad2, label: 'Betas', value: stats.betas, gradient: 'from-amber-400 to-bronze-500' },
    { icon: Download, label: 'Descargas', value: stats.totalDownloads, gradient: 'from-olive-400 to-sepia-500' },
    { icon: Heart, label: 'Likes recibidos', value: stats.totalLikesReceived, gradient: 'from-wine-500 to-wine-700' },
    { icon: Users, label: 'Seguidores', value: stats.followers, gradient: 'from-wine-400 to-wine-500' },
    { icon: MessageSquare, label: 'Comentarios', value: stats.comments, gradient: 'from-bronze-400 to-bronze-600' },
  ] : []

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-wine-400 to-bronze-500 text-white shadow-sm">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold font-display leading-tight">Reportes de actividad</h1>
          <p className="text-xs text-muted-foreground">
            Todo lo que ha pasado en tu cuenta, en un vistazo
          </p>
        </div>
      </div>

      {statsLoading || !stats ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20 rounded-md" />)}
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : (
        <>
          {/* Totales */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cards.map((card, i) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass-card flex items-center gap-2.5 p-3"
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm', card.gradient)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-none">{card.value}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{card.label}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Actividad + resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-bronze-400 to-wine-500 text-white">
                  <Star className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">Tu actividad</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tu resumen en la plaza</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <MiniStat label="Siguiendo" value={stats.following} />
                <MiniStat label="Guardados" value={stats.bookmarks} />
                <MiniStat label="Likes dados" value={stats.likes} />
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Actividad (7 días)
                </h3>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {weekTotal === 1 ? '1 publicación' : `${weekTotal} publicaciones`}
                </span>
              </div>
              <div className="flex items-end justify-between gap-1.5 h-28">
                {stats.activityByDay.map((day: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex-1 flex items-end">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(day.count / maxActivity) * 100}%` }}
                        transition={{ delay: i * 0.06, duration: 0.5 }}
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

          {/* Top publicaciones */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-wine-500" />
              Tus publicaciones más queridas
            </h3>
            {profileLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
            ) : topPosts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aún no publicas nada. ¡Comparte tu primer devlog y aparecerá aquí!
              </p>
            ) : (
              <div className="space-y-2">
                {topPosts.map((post: any, i: number) => (
                  <button
                    key={post.id}
                    onClick={() => openPostDetail(post.id)}
                    className="w-full flex items-center gap-3 rounded-md glass p-2.5 text-left hover:bg-secondary/50 transition"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wine-400 to-bronze-500 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{post.content || (post.type === 'BETA' ? post.beta?.title : '(sin texto)')}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(post.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Heart className="h-3 w-3 text-wine-500" /> {post.likesCount ?? 0}</span>
                      <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {post.commentsCount ?? 0}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nota */}
          <p className="text-[11px] text-muted-foreground text-center px-4">
            Tus reportes son privados: solo tú puedes verlos.
          </p>
        </>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center glass rounded-lg p-2">
      <p className="text-sm font-bold leading-none">{value}</p>
      <p className="text-[9px] text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
