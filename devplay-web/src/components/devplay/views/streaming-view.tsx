'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { postService } from '@/services/devplay-service'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { UserAvatar, LiveBadge, PlatformBadge, PlatformIcon } from '@/components/devplay/shared/shared'
import { Radio, ExternalLink, Users, Tv, Radio as RadioIcon } from 'lucide-react'
import { useState } from 'react'

export function StreamingView() {
  const { openPostDetail, openProfile, openGoLive, openAuth } = useUIStore()
  const { user, isAuthed, isGuest } = useCurrentUser()

  const { data, isLoading } = useQuery({
    queryKey: ['live-streams-view'],
    queryFn: () => postService.list({ live: true }),
    refetchInterval: 45000,
    staleTime: 30000,
  })

  const streams = data?.posts ?? []
  const canGoLive = isAuthed && !isGuest

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text-mint flex items-center justify-center gap-2">
          <Tv className="h-7 w-7" />
          Streaming
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Directos en vivo de desarrolladores indie
        </p>
      </div>

      {/* CTA Dev */}
      {canGoLive && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card card-mint p-5 text-center"
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-olive-400 to-sepia-500 text-white">
            <RadioIcon className="h-7 w-7" />
          </div>
          <h3 className="font-bold text-lg">¿Listo para streaminear?</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Inicia un directo y tus seguidores recibirán una notificación al instante
          </p>
          <Button onClick={openGoLive} className="btn-gradient-live rounded-sm gap-2">
            <Radio className="h-4 w-4 live-pulse" />
            Iniciar Directo
          </Button>
        </motion.div>
      )}

      {!isAuthed && (
        <div className="glass-card card-mint p-5 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Inicia sesión para hacer directos y compartir tu proceso de desarrollo
          </p>
          <Button onClick={() => openAuth('login')} className="btn-gradient-live rounded-sm">
            Entrar
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Radio} value={streams.length} label="En vivo" color="from-wine-500 to-wine-700" pulse />
        <StatCard icon={Users} value="∞" label="Espectadores" color="from-wine-400 to-wine-500" />
        <StatCard icon={Tv} value="3" label="Plataformas" color="from-olive-400 to-sepia-500" />
      </div>

      {/* Grid de streams */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-md" />)}
        </div>
      ) : streams.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-olive-300 to-sepia-400 text-white">
            <Tv className="h-8 w-8" />
          </div>
          <p className="font-semibold text-lg">No hay directos ahora mismo</p>
          <p className="text-sm text-muted-foreground mt-1">
            Vuelve más tarde o sigue a tus devs para no perderte el próximo directo
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {streams.map((s) => (
            <StreamCard key={s.id} post={s} onOpen={() => openPostDetail(s.id)} onProfile={() => openProfile(s.author.id)} />
          ))}
        </div>
      )}

      <div className="h-8" />
    </div>
  )
}

function StatCard({ icon: Icon, value, label, color, pulse }: { icon: any; value: any; label: string; color: string; pulse?: boolean }) {
  return (
    <div className="glass-card flex flex-col items-center gap-1 p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-white ${pulse ? 'live-pulse' : ''}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function StreamCard({ post, onOpen, onProfile }: { post: any; onOpen: () => void; onProfile: () => void }) {
  const stream = post.stream
  const [showEmbed, setShowEmbed] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card overflow-hidden"
    >
      {/* Thumbnail / embed */}
      <div className="relative aspect-video bg-black cursor-pointer" onClick={() => setShowEmbed(!showEmbed)}>
        {showEmbed ? (
          <iframe
            src={stream.embedUrl}
            className="h-full w-full"
            allowFullScreen
            allow="autoplay; fullscreen"
            title={stream.title}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-wine-300 via-sepia-300 to-wine-300 dark:from-wine-500/30 dark:via-sepia-500/30 dark:to-wine-500/30">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white/30 backdrop-blur">
                <Radio className="h-8 w-8 text-white live-pulse" />
              </div>
              <p className="text-xs text-white/90 font-medium">Haz clic para reproducir</p>
            </div>
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <LiveBadge />
          <PlatformBadge platform={stream.platform} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start gap-2">
          <button onClick={onProfile}>
            <UserAvatar username={post.author.username} avatar={post.author.avatar} size="md" />
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm line-clamp-1">{stream.title}</h3>
            <button onClick={onProfile} className="text-xs text-muted-foreground hover:underline">
              @{post.author.username}
            </button>
          </div>
        </div>
        {post.content && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{post.content}</p>
        )}
        <div className="flex gap-2 mt-3">
          <Button size="sm" className="btn-gradient-live rounded-sm flex-1 gap-1.5" onClick={onOpen}>
            <Radio className="h-3.5 w-3.5 live-pulse" />
            Ver directo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full gap-1.5"
            onClick={() => window.open(stream.streamUrl, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <PlatformIcon platform={stream.platform} className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
