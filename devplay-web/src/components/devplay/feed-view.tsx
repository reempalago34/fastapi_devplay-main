'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type Post } from '@/lib/devplay-api'
import { PostCard } from './post-card'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Radio, Sparkles, FileText, Gamepad2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type FeedFilter = 'all' | 'live' | 'betas' | 'posts'

export function FeedView() {
  const qc = useQueryClient()
  const { openAuth } = useUIStore()
  const { user, isGuest } = useCurrentUser()
  const [filter, setFilter] = useState<FeedFilter>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['posts', filter],
    queryFn: async () => {
      if (filter === 'live') return api.getPosts({ live: true })
      if (filter === 'betas') return api.getPosts({ type: 'BETA' })
      if (filter === 'posts') return api.getPosts({ type: 'POST' })
      return api.getPosts()
    },
    refetchInterval: filter === 'live' ? 15000 : false,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['posts'] })

  const posts = data?.posts ?? []
  // Sort: live streams first, then by date
  const sorted = [...posts].sort((a, b) => {
    if (a.type === 'STREAM' && a.stream?.isLive && !(b.type === 'STREAM' && b.stream?.isLive)) return -1
    if (b.type === 'STREAM' && b.stream?.isLive && !(a.type === 'STREAM' && a.stream?.isLive)) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const filters: { id: FeedFilter; label: string; icon: any }[] = [
    { id: 'all', label: 'Todo', icon: Sparkles },
    { id: 'live', label: 'En vivo', icon: Radio },
    { id: 'betas', label: 'Betas', icon: Gamepad2 },
    { id: 'posts', label: 'Posts', icon: FileText },
  ]

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div id="devplay-feed" className="glass-card flex gap-1 p-1 sticky top-16 z-10">
        {filters.map((f) => {
          const Icon = f.icon
          const active = filter === f.id
          return (
            <Button
              key={f.id}
              variant={active ? 'default' : 'ghost'}
              size="sm"
              className={cn('flex-1 gap-1.5 h-9', active && 'shadow-md')}
              onClick={() => setFilter(f.id)}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">{f.label}</span>
            </Button>
          )
        })}
      </div>

      {/* Live banner */}
      {filter === 'live' && posts.length === 0 && !isLoading && (
        <div className="glass-card p-8 text-center">
          <Radio className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">No hay directos ahora mismo</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sigue a tus devs favoritos para recibir notificaciones cuando estén en vivo
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-48 w-full rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Posts */}
      {!isLoading && sorted.length > 0 && (
        <div className="space-y-4">
          {sorted.map((post) => (
            <PostCard key={post.id} post={post} onChange={refresh} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sorted.length === 0 && filter !== 'live' && (
        <div className="glass-card p-12 text-center">
          <Gamepad2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="font-semibold text-lg">Aún no hay publicaciones</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sé el primero en compartir algo con la comunidad
          </p>
          {isGuest ? (
            <Button className="mt-4" onClick={() => openAuth('register')}>
              Crear cuenta para publicar
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground mt-4">
              Usa el botón "Crear" en la parte superior
            </p>
          )}
        </div>
      )}

      {/* End spacer */}
      <div className="h-8" />
    </div>
  )
}
