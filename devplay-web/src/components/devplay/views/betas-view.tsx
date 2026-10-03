'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { postService } from '@/services/devplay-service'
import { orderBetasByRichness } from '@/lib/beta-order'
import { useUIStore } from '@/lib/stores'
import { UserAvatar, BetaStatusBadge, formatBytes } from '@/components/devplay/shared/shared'
import { BETA_STATUSES, getBetaStatusMeta, type BetaStatus } from '@/types/devplay'
import {
  Gamepad2, Download, Heart, Search, X, Filter, Star,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const GENRES = ['Plataformas', 'RPG', 'Puzzle', 'Aventura', 'Shooter', 'Estrategia', 'Terror', 'Carreras', 'Deportes', 'Simulación', 'Otro']
const PLATFORMS = ['PC', 'Mac', 'Linux', 'Android', 'iOS', 'Web']

export function BetasView() {
  const { openPostDetail } = useUIStore()
  const [statusFilter, setStatusFilter] = useState<BetaStatus | 'all'>('all')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['betas-view'],
    queryFn: () => postService.list({ type: 'BETA' }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  })

  // Orden editorial: juegos con GIF de primeros, luego los de más capturas
  const allBetas = orderBetasByRichness(data?.posts ?? [], (p) => p.beta)

  // Apply filters
  const filtered = allBetas.filter(post => {
    const beta = post.beta
    if (!beta) return false

    if (statusFilter !== 'all' && (beta.betaStatus ?? 'open_beta') !== statusFilter) return false
    if (genreFilter !== 'all' && beta.genre !== genreFilter) return false
    if (platformFilter !== 'all' && (!beta.platforms || !beta.platforms.includes(platformFilter))) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchesTitle = beta.title.toLowerCase().includes(q)
      const matchesDesc = beta.description.toLowerCase().includes(q)
      const matchesAuthor = post.author.username.toLowerCase().includes(q)
      if (!matchesTitle && !matchesDesc && !matchesAuthor) return false
    }
    return true
  })

  const hasActiveFilters = statusFilter !== 'all' || genreFilter !== 'all' || platformFilter !== 'all'

  function clearFilters() {
    setStatusFilter('all')
    setGenreFilter('all')
    setPlatformFilter('all')
    setSearch('')
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text-peach flex items-center justify-center gap-2">
          <Gamepad2 className="h-7 w-7" />
          Centro de Betas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Descubre y prueba juegos en desarrollo · {allBetas.length} betas disponibles
        </p>
      </div>

      {/* Search + Filters toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar betas..."
            className="w-full rounded-full border border-input bg-transparent pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="rounded-full gap-1.5"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {hasActiveFilters && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-primary text-[9px] font-bold">!</span>}
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-card p-4 space-y-3 overflow-hidden"
        >
          {/* Status filter */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Estado</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="Todos" />
              {BETA_STATUSES.map(s => (
                <FilterChip
                  key={s.id}
                  active={statusFilter === s.id}
                  onClick={() => setStatusFilter(s.id)}
                  label={s.label}
                />
              ))}
            </div>
          </div>

          {/* Genre filter */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Género</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={genreFilter === 'all'} onClick={() => setGenreFilter('all')} label="Todos" />
              {GENRES.map(g => (
                <FilterChip key={g} active={genreFilter === g} onClick={() => setGenreFilter(g)} label={g} />
              ))}
            </div>
          </div>

          {/* Platform filter */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Plataforma</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={platformFilter === 'all'} onClick={() => setPlatformFilter('all')} label="Todas" />
              {PLATFORMS.map(p => (
                <FilterChip key={p} active={platformFilter === p} onClick={() => setPlatformFilter(p)} label={p} />
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-full text-xs gap-1">
              <X className="h-3 w-3" /> Limpiar filtros
            </Button>
          )}
        </motion.div>
      )}

      {/* Grid de betas */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 rounded-md" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Gamepad2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="font-semibold text-lg">No se encontraron betas</p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters ? 'Prueba con otros filtros' : 'Aún no hay betas publicadas'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3 rounded-full">
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((post, i) => {
            const beta = post.beta!
            const statusMeta = getBetaStatusMeta(beta.betaStatus)
            const screenshots = beta.screenshots ?? []
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card overflow-hidden"
              >
                {/* Cover */}
                <div
                  className={cn('aspect-video relative overflow-hidden bg-gradient-to-br cursor-pointer', statusMeta.color)}
                  onClick={() => openPostDetail(post.id)}
                >
                  {beta.coverImage ? (
                    <img src={beta.coverImage} alt={beta.title} className="absolute inset-0 w-full h-full object-contain p-2" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-5xl font-black text-white/30 select-none drop-shadow">
                        {beta.title.charAt(0).toUpperCase()}
                      </span>
                      <Gamepad2 className="absolute bottom-2 right-2 h-5 w-5 text-white/25" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <BetaStatusBadge status={beta.betaStatus} />
                  </div>
                  {beta.version && (
                    <span className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-white">
                      {beta.version}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  {/* Title + author */}
                  <div className="flex items-start gap-2 mb-2">
                    <div className="min-w-0 flex-1" onClick={() => openPostDetail(post.id)}>
                      <h3 className="font-bold text-base truncate cursor-pointer hover:underline">{beta.title}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <UserAvatar username={post.author.username} avatar={post.author.avatar} size="sm" className="h-5 w-5" />
                        <span className="text-[11px] text-muted-foreground">@{post.author.username}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{beta.description}</p>

                  {/* Screenshots gallery (horizontal scroll like Play Store) */}
                  {screenshots.length > 0 && (
                    <div className="mb-3">
                      <div className="flex gap-2 overflow-x-auto custom-scroll pb-1 -mx-1 px-1">
                        {screenshots.map((url, idx) => (
                          <button
                            key={idx}
                            onClick={() => setLightbox({ urls: screenshots, index: idx })}
                            className="shrink-0 w-32 h-20 rounded-lg overflow-hidden glass transition"
                          >
                            <img src={url} alt={`Captura ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px]">
                    {beta.genre && (
                      <span className="rounded-full bg-wine-100 px-2 py-0.5 font-medium text-wine-700 dark:bg-wine-500/20 dark:text-wine-300">
                        {beta.genre}
                      </span>
                    )}
                    {beta.platforms && beta.platforms.length > 0 && (
                      <span className="rounded-full bg-wine-100 px-2 py-0.5 font-medium text-wine-700 dark:bg-wine-500/20 dark:text-wine-300">
                        {beta.platforms.join(', ')}
                      </span>
                    )}
                    {beta.tags && beta.tags.length > 0 && beta.tags.slice(0, 3).map(t => (
                      <span key={t} className="rounded-full bg-secondary px-1.5 py-0.5 text-muted-foreground">#{t}</span>
                    ))}
                  </div>

                  {/* Stats + button */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
                    <span className="flex items-center gap-0.5">
                      <Download className="h-3 w-3" /> {beta.downloads} descargas
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart className="h-3 w-3" /> {post.likesCount}
                    </span>
                  </div>

                  {/* Ver detalles button */}
                  <Button
                    size="sm"
                    className="btn-gradient-beta w-full rounded-sm gap-1.5"
                    onClick={() => openPostDetail(post.id)}
                  >
                    <Download className="h-4 w-4" />
                    Ver detalles y descargar
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Lightbox para capturas */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10"
              onClick={() => setLightbox(null)}
            >
              <X className="h-5 w-5" />
            </button>

            {/* Navigation arrows */}
            {lightbox.urls.length > 1 && (
              <>
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10"
                  onClick={(e) => { e.stopPropagation(); setLightbox(prev => prev ? { ...prev, index: (prev.index - 1 + prev.urls.length) % prev.urls.length } : null) }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10"
                  onClick={(e) => { e.stopPropagation(); setLightbox(prev => prev ? { ...prev, index: (prev.index + 1) % prev.urls.length } : null) }}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            <motion.div
              key={lightbox.index}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={lightbox.urls[lightbox.index]} alt="Captura" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
              <p className="text-center text-white text-xs mt-2">
                {lightbox.index + 1} / {lightbox.urls.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border bg-secondary/60 text-secondary-foreground hover:border-primary/40'
      )}
    >
      {label}
    </button>
  )
}
