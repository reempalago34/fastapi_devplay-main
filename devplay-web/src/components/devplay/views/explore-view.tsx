'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { postService } from '@/services/devplay-service'
import { orderBetasByRichness } from '@/lib/beta-order'
import { PostCard } from '@/components/devplay/post/post-card'
import { AdSlot } from '@/components/devplay/shared/ad-slot'
import { AD_EVERY_POSTS } from '@/lib/ads'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import {
  Radio, Sparkles, Gamepad2, Compass, Flame, TrendingUp, Users, Home,
  Video, ImagePlus, BarChart3, ArrowRight, Eye,
} from 'lucide-react'
import { UserAvatar } from '@/components/devplay/shared/shared'
import { HeroTicker } from '@/components/devplay/shared/hero-ticker'
import { EmptyState } from '@/components/devplay/shared/skeletons'
import { cn } from '@/lib/utils'

type FeedFilter = 'foryou' | 'following' | 'all' | 'trending' | 'devlogs' | 'news'

export function ExploreView() {
  const qc = useQueryClient()
  const { openAuth, openCreatePost, openCreateBeta, openCreatePoll, communityTab, communitySignal, setCommunityTab } = useUIStore()
  const { user, isGuest } = useCurrentUser()
  const [filter, setFilter] = useState<FeedFilter>(communityTab === 'trending' ? 'trending' : 'foryou')
  const [prevSignal, setPrevSignal] = useState(communitySignal)
  // Sincroniza la pestaña cuando se llega desde "Trending" del sidebar,
  // ajustando el estado durante el render (patrón recomendado, sin effects)
  if (communitySignal !== prevSignal) {
    setPrevSignal(communitySignal)
    if (communityTab === 'trending') setFilter('trending')
  }

  const { data, isLoading } = useQuery({
    queryKey: ['posts', filter],
    queryFn: async () => {
      if (filter === 'all' || filter === 'trending') return postService.list()
      if (filter === 'devlogs') return postService.list({ type: 'BETA' })
      /* `following`, `news` y `foryou` son ordenaciones del feed, no filtros del
         backend: la API solo sabe filtrar por autor y por tipo. Se piden todos
         los posts y el orden se aplica abajo (los en directo primero, y por
         engagement cuando es "trending"). */
      return postService.list()
    },
    refetchInterval: false,
  })

  const { data: discoverData } = useQuery({
    queryKey: ['discover'],
    queryFn: () => postService.list({ type: 'BETA' }),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['posts'] })

  const posts = data?.posts ?? []
  const engagement = (p: (typeof posts)[number]) =>
    p.likesCount + p.commentsCount * 2 + p.repostsCount * 3
  const sorted = [...posts].sort((a, b) => {
    if (filter === 'trending') {
      return engagement(b) - engagement(a)
    }
    const aLive = a.type === 'STREAM' && a.stream?.isLive
    const bLive = b.type === 'STREAM' && b.stream?.isLive
    if (aLive && !bLive) return -1
    if (bLive && !aLive) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Descubrir juegos: GIF primero, luego los de más capturas (orden editorial)
  const discoverBetas = orderBetasByRichness(discoverData?.posts ?? [], (p) => p.beta).slice(0, 4)

  // Cintas del hero: los juegos 5–16 del orden editorial (los 4 mejores ya
  // aparecen en grande en la tira "Descubrir juegos" — evita repetirlos aquí)
  const tickerGames = orderBetasByRichness(discoverData?.posts ?? [], (p) => p.beta)
    .filter((p) => p.beta?.title)
    .slice(4, 16)
    .map((p) => ({
      id: p.id,
      title: p.beta!.title,
      version: p.beta!.version,
      genre: p.beta!.genre,
      coverImage: p.beta!.coverImage,
      downloads: p.beta!.downloads,
    }))

  const filters: { id: FeedFilter; label: string }[] = [
    { id: 'foryou', label: 'Para ti' },
    { id: 'trending', label: 'Trending' },
    { id: 'following', label: 'Siguiendo' },
    { id: 'all', label: 'Todos' },
    { id: 'devlogs', label: 'Devlogs' },
    { id: 'news', label: 'Noticias' },
  ]

  return (
    <div className="space-y-4">
      {/* ===== HERO BANNER — ilustración retro con velo espresso ===== */}
      <div className="relative h-72 sm:h-80 rounded-sm overflow-hidden frame-double bg-foreground text-background dark:bg-card dark:text-foreground">
        {/* Foto retro de fondo */}
        <Image
          src="/hero-devplay.png"
          alt=""
          aria-hidden
          fill
          priority
          sizes="(max-width: 768px) 100vw, 896px"
          className="object-cover sepia-[0.22] contrast-[0.95] brightness-[0.92]"
        />
        {/* Velo espresso/cacao para legibilidad del texto */}
        <div className="absolute inset-0 bg-foreground/72 dark:bg-background/78" />

        {/* Filetes ornamentales decorativos de fondo */}
        <div className="absolute inset-3 border border-current/15 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 py-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            <p className="label-caps opacity-70 mb-3">Gaceta de desarrolladores · Est. 2025</p>
            <div className="rule-ornate w-44 mb-5 opacity-70">
              <span className="text-[9px] leading-none">◆</span>
            </div>
            <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight leading-none">
              Dev<span className="text-wine-400 dark:text-wine-500">Play</span>
            </h1>
            <p className="text-sm sm:text-lg mt-3 opacity-75 italic">
              Descubre, comparte y crea todo sobre videojuegos
            </p>
            <div className="rule-ornate w-44 mt-5 mb-6 opacity-70">
              <span className="text-[9px] leading-none">◆</span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <Button
                size="sm"
                className="rounded-sm gap-1.5 bg-background text-foreground border border-border hover:bg-secondary dark:bg-background dark:text-foreground"
                onClick={() => useUIStore.getState().setView('discover')}
              >
                <Sparkles className="h-4 w-4" />
                Descubrir juegos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-sm gap-1.5 border-current/30 text-current hover:bg-current/10 bg-transparent"
                onClick={() => useUIStore.getState().setView('betas')}
              >
                <Gamepad2 className="h-4 w-4" />
                Explorar betas
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Cintas de teletipo — los juegos pasando, como en las gacetas retro 🎞️ */}
      <HeroTicker games={tickerGames} onOpenGame={(postId) => useUIStore.getState().openPostDetail(postId)} />

      {/* ===== DESCUBRIR JUEGOS — siempre arriba, justo bajo el hero, nada la baja ===== */}
      {discoverBetas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-section flex items-center gap-2">
              <Compass className="h-5 w-5 text-wine-600 dark:text-wine-400" />
              Descubrir juegos
            </h2>
            <button
              onClick={() => useUIStore.getState().setView('betas')}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {discoverBetas.map((post, i) => {
              const beta = post.beta
              if (!beta) return null
              return (
                <motion.button
                  key={post.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => useUIStore.getState().openPostDetail(post.id)}
                  className="glass-card overflow-hidden text-left"
                >
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/30 relative overflow-hidden">
                    {beta.coverImage ? (
                      <img src={beta.coverImage} alt="" className="absolute inset-0 w-full h-full object-contain p-2" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-black text-primary/40 select-none">
                          {beta.title.charAt(0).toUpperCase()}
                        </span>
                        <Gamepad2 className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 text-primary/30" />
                      </div>
                    )}
                    {beta.version && (
                      <span className="absolute top-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white">
                        {beta.version}
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold truncate">{beta.title}</p>
                    <p className="text-[9px] text-muted-foreground truncate">@{post.author.username}</p>
                    <div className="flex items-center gap-2 mt-1 text-[8px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" /> {beta.downloads}</span>
                      {beta.genre && <span className="truncate">{beta.genre}</span>}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== POST COMPOSER ===== */}
      {user && (
        <div className="glass-card p-3 flex items-center gap-3">
          <UserAvatar username={user.username} avatar={user.avatar} size="md" className="shrink-0" />
          <button
            onClick={openCreateBeta}
            className="flex-1 text-left text-sm text-muted-foreground rounded-sm bg-secondary/50 px-4 py-2.5 hover:bg-secondary transition italic"
          >
            Comparte tu juego con la comunidad 🎮
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            <ComposerBtn icon={Video} label="Video" onClick={openCreatePost} />
            <ComposerBtn icon={Gamepad2} label="Beta" onClick={openCreateBeta} />
            <ComposerBtn icon={BarChart3} label="Encuesta" onClick={openCreatePoll} />
            <ComposerBtn icon={ImagePlus} label="Imagen" onClick={openCreatePost} />
          </div>
        </div>
      )}

      {/* ===== FILTER TABS ===== */}
      <div id="devplay-feed" className="flex gap-1 border-b border-border/40 sticky top-16 z-10 bg-background/80">
        {filters.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id)
                // Al elegir manualmente, se limpia el filtro procedente del sidebar
                if (communityTab) setCommunityTab(null)
              }}
              className={cn(
                'px-3 py-2 text-xs font-medium transition relative',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
              {active && (
                <motion.div
                  layoutId="feed-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ===== FEED ===== */}
      {isLoading ? (
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
      ) : sorted.length > 0 ? (
        <div className="space-y-4">
          {sorted.map((post, i) => (
            <div key={post.id} className="space-y-4">
              <PostCard post={post} onChange={refresh} />
              {/* Espacio de publicidad cada N posts 📢 (no molesta, patrocina la plaza) */}
              {(i + 1) % AD_EVERY_POSTS === 0 && i !== sorted.length - 1 && <AdSlot />}
            </div>
          ))}
        </div>
      ) : (
        /* Estado vacío del feed. Se usa EmptyState en vez del div a mano para que
           tenga la pantalla de consola; el botón de "crear cuenta" se pasa
           como `action` para que quede debajo. */
        <EmptyState
          icon="default"
          style="console"
          title="Aun no hay publicaciones"
          description="Se el primero en compartir algo con la comunidad"
          lines={['$ devplay feed --scan', '$ 0 publicaciones', '$ esperando al primer dev...', '$ _']}
          action={
            isGuest ? (
              <Button className="btn-gradient-primary rounded-sm" onClick={() => openAuth('register')}>
                Crear cuenta para publicar
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="h-8" />
    </div>
  )
}

function ComposerBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
