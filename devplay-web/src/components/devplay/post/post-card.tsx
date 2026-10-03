'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Heart,
  MessageCircle,
  Download,
  ExternalLink,
  Share2,
  Radio,
  Gamepad2,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Flag,
  Ban,
  Repeat2,
  X,
} from 'lucide-react'
import { postService, betaService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { toast } from 'sonner'
import { UserAvatar, TimeAgo, LiveBadge, PlatformBadge, UserTags, formatBytes, ParsedContent } from '@/components/devplay/shared/shared'
import { ReportModal } from '@/components/devplay/modals/report-modal'
import { ShareModal } from '@/components/devplay/modals/share-modal'
import { PollWidget } from '@/components/devplay/post/poll-widget'
import { cn } from '@/lib/utils'
import type { Post } from '@/types/devplay'

export function PostCard({ post, onChange }: { post: Post; onChange?: () => void }) {
  const { user, isAuthed, isGuest } = useCurrentUser()
  const { openAuth, openPostDetail, openProfile } = useUIStore()
  const [liked, setLiked] = useState(post.liked)
  const [likesCount, setLikesCount] = useState(post.likesCount)
  const [commentsCount, setCommentsCount] = useState(post.commentsCount)
  const [showShare, setShowShare] = useState(false)
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; kind: 'image' | 'video' } | null>(null)

  // En posts BETA el carrusel ya muestra portada (slide 1) + capturas — el grid
  // de media de arriba NO debe repetirlas (portada duplicada, bug reportado).
  // Se filtra en render: los datos de Supabase quedan intactos.
  const carouselUrls = post.type === 'BETA' && post.beta
    ? [post.beta.coverImage, ...(post.beta.screenshots ?? [])].filter(Boolean)
    : null
  const mediaForGrid = carouselUrls
    ? post.mediaUrls.filter(m => !carouselUrls.includes(m.url))
    : post.mediaUrls
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post.content || '')
  const [editLoading, setEditLoading] = useState(false)

  // Sincronizar contadores cuando el post se actualiza (tras invalidateQueries)
  useEffect(() => {
    queueMicrotask(() => {
      setLiked(post.liked)
      setLikesCount(post.likesCount)
      setCommentsCount(post.commentsCount)
    })
  }, [post.liked, post.likesCount, post.commentsCount])

  const canInteract = isAuthed && !isGuest
  const isAuthor = user?.id === post.author.id

  async function handleLike() {
    if (!canInteract) {
      openAuth('login')
      return
    }
    if (liked) {
      setLiked(false)
      setLikesCount((c) => c - 1)
      try { await postService.unlike(post.id) } catch { setLiked(true); setLikesCount((c) => c + 1) }
    } else {
      setLiked(true)
      setLikesCount((c) => c + 1)
      try { await postService.like(post.id) } catch { setLiked(false); setLikesCount((c) => c - 1) }
    }
  }

  async function handleBetaDownload() {
    // Abrir el detalle de la beta (no descargar directamente)
    openPostDetail(post.id)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta publicación?')) return
    try {
      await postService.delete(post.id)
      toast.success('Publicación eliminada')
      onChange?.()
    } catch { toast.error('No se pudo eliminar') }
  }

  async function handleSaveEdit() {
    setEditLoading(true)
    try {
      await postService.edit(post.id, editText)
      toast.success('Publicación editada')
      setEditing(false)
      onChange?.()
    } catch (err: any) {
      toast.error(err.message || 'No se pudo editar')
    } finally {
      setEditLoading(false)
    }
  }

  function startEdit() {
    setEditText(post.content || '')
    setEditing(true)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass-card overflow-hidden',
        post.type === 'STREAM' && post.stream?.isLive && 'ring-2 ring-wine-400/40'
      )}
    >
      {/* Repost indicator */}
      {post.repostOf && (
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          <span>{post.author.username} reposteó</span>
          <button
            onClick={() => openProfile(post.repostOf!.author.id)}
            className="font-medium text-primary hover:underline"
          >
            @{post.repostOf.author.username}
          </button>
        </div>
      )}

      {/* Repost: publicación original COMPLETA — clickeable para ver el original */}
      {post.repostOf && (
        <div
          className="mx-4 mb-2 rounded-md border border-border/50 overflow-hidden glass cursor-pointer hover:border-primary/40 transition"
          onClick={() => openPostDetail(post.repostOf!.id)}
        >
          {/* Header del autor original */}
          <div className="flex items-center gap-2 p-3 pb-1">
            <button
              onClick={(e) => { e.stopPropagation(); openProfile(post.repostOf!.author.id) }}
            >
              <UserAvatar username={post.repostOf.author.username} avatar={post.repostOf.author.avatar} size="sm" />
            </button>
            <div className="min-w-0 flex-1">
              <button
                onClick={(e) => { e.stopPropagation(); openProfile(post.repostOf!.author.id) }}
                className="font-semibold text-xs hover:underline truncate block"
              >
                {post.repostOf.author.username}
              </button>
              <TimeAgo date={post.repostOf.createdAt} className="text-[10px]" />
            </div>
          </div>

          {/* Contenido completo */}
          {post.repostOf.content && (
            <div className="px-3 pb-2">
              <p className="text-sm whitespace-pre-wrap break-words">{post.repostOf.content}</p>
            </div>
          )}

          {/* Media completo */}
          {post.repostOf.mediaUrls && post.repostOf.mediaUrls.length > 0 && (
            <div className={cn(
              'grid gap-1',
              post.repostOf.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            )}>
              {post.repostOf.mediaUrls.map((m, i) => (
                <div key={i} className="overflow-hidden bg-black/5">
                  {m.kind === 'image' ? (
                    <img src={m.url} alt="" className="w-full max-h-[400px] object-cover" loading="lazy" />
                  ) : (
                    <video src={m.url} controls className="w-full max-h-[400px] object-contain bg-black" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Beta completa */}
          {post.repostOf.beta && (
            <div className="mx-3 mb-3 mt-2 card-peach rounded-md p-3">
              <div className="flex items-start gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Gamepad2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-xs truncate">{post.repostOf.beta.title}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{post.repostOf.beta.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px]">
                    {post.repostOf.beta.genre && (
                      <span className="rounded-full bg-wine-100 px-1.5 py-0.5 font-medium text-wine-700 dark:bg-wine-500/20 dark:text-wine-300">
                        {post.repostOf.beta.genre}
                      </span>
                    )}
                    {post.repostOf.beta.downloadType && (
                      <span className="rounded-full bg-wine-100 px-1.5 py-0.5 font-medium text-wine-700 dark:bg-wine-500/20 dark:text-wine-300">
                        {post.repostOf.beta.downloadType === 'DIRECT' ? 'Archivo' : 'Enlace'}
                      </span>
                    )}
                    <span className="text-muted-foreground">· {post.repostOf.beta.downloads} descargas</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats del original + ver publicación */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" /> {post.repostOf.likesCount}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" /> {post.repostOf.commentsCount}
            </span>
            <span className="ml-auto flex items-center gap-0.5 text-primary font-medium">
              Ver publicación original →
            </span>
          </div>
        </div>
      )}

      {/* Header del usuario que reposteó */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <button onClick={() => openProfile(post.author.id)}>
          <UserAvatar username={post.author.username} avatar={post.author.avatar} size="md" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => openProfile(post.author.id)}
              className="font-semibold text-sm hover:underline truncate"
            >
              {post.author.username}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TimeAgo date={post.createdAt} />
            {post.author.tags && post.author.tags.length > 0 && (
              <UserTags tags={post.author.tags} size="xs" max={2} />
            )}
          </div>
        </div>
        {isAuthor ? (
          <AuthorActionsMenu onDelete={handleDelete} onEdit={startEdit} />
        ) : (
          <PostActionsMenu postId={post.id} authorId={post.author.id} authorName={post.author.username} />
        )}
      </div>

      {/* Content */}
      {post.content && !editing && (
        <div className="px-4 pb-3">
          <ParsedContent
            text={post.content}
            className="text-sm whitespace-pre-wrap break-words"
            onMention={(username) => {
              // Buscar usuario por username y abrir perfil
              import('@/services/devplay-service').then(s => {
                s.userService.getByUsername(username).then(res => {
                  if (res.user) openProfile(res.user.id)
                }).catch(() => {})
              })
            }}
            onHashtag={(tag) => {
              // Abrir búsqueda con el hashtag
              toast.info(`#${tag} — búsqueda de hashtags próximamente`)
            }}
          />
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="px-4 pb-3 space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            maxLength={2000}
            className="w-full rounded-md bg-secondary/50 border border-border/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="rounded-full">Cancelar</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={editLoading} className="btn-gradient-primary rounded-sm">
              {editLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}

      {/* Media — clickeable para abrir en grande (en betas omite portada/capturas del carrusel) */}
      {mediaForGrid.length > 0 && (
        <div className={cn('grid gap-1', mediaForGrid.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {mediaForGrid.map((m, i) => (
            <div key={i} className="overflow-hidden bg-black/5 cursor-pointer relative group" onClick={() => setLightboxMedia({ url: m.url, kind: m.kind })}>
              {m.kind === 'image' ? (
                <img src={m.url} alt="" className="w-full max-h-[500px] object-cover" loading="lazy" />
              ) : (
                <video src={m.url} className="w-full max-h-[500px] object-contain bg-black" controls />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox — imagen/video en grande */}
      <AnimatePresence>
        {lightboxMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightboxMedia(null)}
          >
            <button
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10"
              onClick={() => setLightboxMedia(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxMedia.kind === 'image' ? (
                <img src={lightboxMedia.url} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
              ) : (
                <video src={lightboxMedia.url} controls autoPlay className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream embed */}
      {post.type === 'STREAM' && post.stream && <StreamEmbed post={post} />}

      {/* Beta section */}
      {post.type === 'BETA' && post.beta && (
        <BetaSection
          post={post}
          onDownload={handleBetaDownload}
          canInteract={canInteract}
          onOpenMedia={(url) => setLightboxMedia({ url, kind: 'image' })}
        />
      )}

      {/* Poll widget */}
      {(post.type === 'POLL' || post.poll) && (
        <PollWidget postId={post.id} poll={post.poll} />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 p-2 border-t border-border/40">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={cn('gap-1.5 rounded-full btn-press', liked && 'text-wine-500')}
        >
          <Heart className={cn('h-4 w-4', liked && 'fill-current like-pop')} key={liked ? 'on' : 'off'} />
          <span className="text-xs count-bump" key={likesCount}>{likesCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openPostDetail(post.id)} className="gap-1.5 rounded-full btn-press">
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs">{commentsCount}</span>
        </Button>
        {post.type === 'BETA' && post.beta && (
          <Button variant="ghost" size="sm" className="gap-1.5 rounded-full" disabled>
            <Download className="h-4 w-4" />
            <span className="text-xs">{post.beta.downloads}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 ml-auto rounded-full"
          onClick={() => setShowShare(true)}
        >
          <Share2 className="h-4 w-4" />
          {post.repostsCount > 0 && <span className="text-xs">{post.repostsCount}</span>}
        </Button>
      </div>

      {/* Share Modal */}
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        postId={post.id}
        authorName={post.author.username}
        postContent={post.content}
      />
    </motion.article>
  )
}

function StreamEmbed({ post }: { post: Post }) {
  const stream = post.stream!
  return (
    <div className="relative">
      <div className="aspect-video w-full bg-black">
        <iframe
          src={stream.embedUrl}
          className="h-full w-full"
          allowFullScreen
          allow="autoplay; fullscreen"
          title={stream.title}
        />
      </div>
      <div className="absolute top-2 left-2 flex items-center gap-2">
        {stream.isLive && <LiveBadge />}
        <PlatformBadge platform={stream.platform} />
      </div>
      <div className="p-3 bg-gradient-to-r from-wine-500/10 via-sepia-500/5 to-transparent">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-wine-500 live-pulse" />
          <p className="font-semibold text-sm flex-1 truncate">{stream.title}</p>
        </div>
        <a
          href={stream.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-wine-500 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Ver directo en {stream.platform}
        </a>
      </div>
    </div>
  )
}

function BetaSection({ post, onDownload, canInteract, onOpenMedia }: { post: Post; onDownload: () => void; canInteract: boolean; onOpenMedia?: (url: string) => void }) {
  const beta = post.beta!
  const [showDetails, setShowDetails] = useState(false)

  // Slides del carrusel (6 en total): PORTADA ARRIBA (slide 1, jamás se quita) + hasta 5 capturas.
  // GIFs primero entre las capturas. Si la portada está repetida dentro de las screenshots se filtra.
  const all = (beta.screenshots ?? []).filter(u => u !== beta.coverImage).slice(0, 5)
  const isGif = (u: string) => u.toLowerCase().includes('.gif')
  const caps = [...all.filter(isGif), ...all.filter((u) => !isGif(u))]
  const slides = beta.coverImage ? [beta.coverImage, ...caps] : caps
  const total = slides.length
  const [slideIdx, setSlideIdx] = useState(0)
  const current = slides[Math.min(slideIdx, Math.max(total - 1, 0))]

  return (
    <div className="mx-4 mb-3 card-peach rounded-lg overflow-hidden">
      {/* Carrusel: portada (slide 1) + capturas — IMÁGENES EN GRANDE, clickeables a pantalla completa */}
      {total > 0 && (
        <div className="relative h-80 sm:h-[28rem] bg-gradient-to-br from-amber-300 to-bronze-400 overflow-hidden">
          <img
            src={current}
            alt={beta.title}
            className="w-full h-full object-contain cursor-zoom-in transition-opacity duration-200"
            onClick={(e) => { e.stopPropagation(); onOpenMedia?.(current) }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />

          {/* Badge de versión (solo en el slide de portada) */}
          {beta.version && slideIdx === 0 && (
            <div className="absolute bottom-2 left-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-white">
                {beta.version}
              </span>
            </div>
          )}

          {/* Flechas */}
          {total > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setSlideIdx((slideIdx - 1 + total) % total) }}
                aria-label="Imagen anterior"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/45 hover:bg-black/65 text-white backdrop-blur flex items-center justify-center transition"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSlideIdx((slideIdx + 1) % total) }}
                aria-label="Imagen siguiente"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/45 hover:bg-black/65 text-white backdrop-blur flex items-center justify-center transition"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              {/* Puntitos */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setSlideIdx(i) }}
                    aria-label={`Ir a imagen ${i + 1}`}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === slideIdx ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {total === 0 && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-accent/30 overflow-hidden relative">
              <span className="text-xl font-black text-primary/50 select-none">
                {beta.title.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm truncate">{beta.title}</h3>
              {beta.version && total === 0 && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold">{beta.version}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{beta.description}</p>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
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
              <span className="rounded-full bg-wine-100 px-2 py-0.5 font-medium text-wine-700 dark:bg-wine-500/20 dark:text-wine-300">
                {beta.downloadType === 'DIRECT' ? 'Archivo' : `${beta.externalPlatform ?? 'Enlace'}`}
              </span>
              {beta.fileSize && beta.downloadType === 'DIRECT' && (
                <span className="text-muted-foreground">{formatBytes(beta.fileSize)}</span>
              )}
              <span className="text-muted-foreground">· {beta.downloads} descargas</span>
            </div>

            {/* Tags */}
            {beta.tags && beta.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {beta.tags.slice(0, 5).map(t => (
                  <span key={t} className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Las capturas se muestran en el carrusel de arriba (portada + hasta 5) */}

        {/* Expandir detalles */}
        {(beta.requirements || beta.installInstructions || beta.changelog) && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mt-3 text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', showDetails && 'rotate-180')} />
            {showDetails ? 'Ocultar detalles' : 'Ver requisitos e instalación'}
          </button>
        )}

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 space-y-2 text-[11px]"
          >
            {beta.requirements && (
              <div className="glass rounded-lg p-2">
                <p className="font-semibold mb-0.5">Requisitos</p>
                <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{beta.requirements}</pre>
              </div>
            )}
            {beta.installInstructions && (
              <div className="glass rounded-lg p-2">
                <p className="font-semibold mb-0.5">Instalación</p>
                <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{beta.installInstructions}</pre>
              </div>
            )}
            {beta.changelog && (
              <div className="glass rounded-lg p-2">
                <p className="font-semibold mb-0.5">📝 Changelog</p>
                <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{beta.changelog}</pre>
              </div>
            )}
          </motion.div>
        )}

        <Button onClick={onDownload} className="btn-gradient-beta w-full mt-3 gap-2 rounded-sm" size="sm">
          <Download className="h-4 w-4" />
          Ver detalles y descargar
        </Button>
      </div>
    </div>
  )
}

// ===== Menú de acciones (reportar/bloquear) para posts de otros =====
// ===== Menú de acciones para el AUTOR (editar / eliminar) =====
function AuthorActionsMenu({ onDelete, onEdit }: { onDelete: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        onClick={() => setOpen(!open)}
        aria-label="Más opciones"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-44 glass-strong rounded-md border border-border/50 shadow-lg overflow-hidden">
            <button
              onClick={() => { onEdit(); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary/60 transition"
            >
              <Pencil className="h-4 w-4 text-wine-500" />
              Editar
            </button>
            <div className="border-t border-border/50" />
            <button
              onClick={() => { onDelete(); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-secondary/60 transition"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function PostActionsMenu({ postId, authorId, authorName }: { postId: string; authorId: string; authorName: string }) {
  const [open, setOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)

  async function handleBlock() {
    setBlockLoading(true)
    try {
      const { securityService } = await import('@/services/security-service')
      await securityService.block(authorId)
      toast.success(`@${authorName} bloqueado`)
      setOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setBlockLoading(false)
    }
  }

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => setOpen(!open)}
          aria-label="Más opciones"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-9 z-50 w-44 glass-strong rounded-md border border-border/50 shadow-lg overflow-hidden">
              <button
                onClick={() => { setShowReport(true); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary/60 transition"
              >
                <Flag className="h-4 w-4 text-red-500" />
                Reportar
              </button>
              <div className="border-t border-border/50" />
              <button
                onClick={handleBlock}
                disabled={blockLoading}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-secondary/60 transition"
              >
                <Ban className="h-4 w-4" />
                Bloquear a @{authorName}
              </button>
            </div>
          </>
        )}
      </div>

      {showReport && (
        <ReportModal open={showReport} onClose={() => setShowReport(false)} type="POST" entityId={postId} />
      )}
    </>
  )
}
