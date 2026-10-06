'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { postService, betaService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { toast } from 'sonner'
import { EditBetaModal } from '@/components/devplay/modals/edit-beta-modal'
import { DownloadBetaModal } from '@/components/devplay/modals/download-beta-modal'
import {
  UserAvatar, TimeAgo, BetaStatusBadge, formatBytes,
} from '@/components/devplay/shared/shared'
import { ShareModal } from '@/components/devplay/modals/share-modal'
import { getBetaStatusMeta, BETA_STATUSES } from '@/types/devplay'
import {
  Download, Heart, MessageCircle, Share2, Bookmark, X, ChevronLeft, ChevronRight,
  Gamepad2, Monitor, Tag, FileText, Settings2, Send, Loader2, Star,
  Globe, Calendar, Check, Megaphone, FlaskConical, Lock, Rocket, Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function BetaDetailView({ postId }: { postId: string }) {
  const { user, isAuthed, isGuest } = useCurrentUser()
  const { openProfile, openAuth } = useUIStore()
  const qc = useQueryClient()
  const [showShare, setShowShare] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDownload, setShowDownload] = useState(false)
  const [saved, setSaved] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const [showAllShots, setShowAllShots] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postService.get(postId),
    enabled: !!postId,
  })

  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => postService.getComments(postId),
    enabled: !!postId,
  })

  useEffect(() => {
    if (data?.post) {
      setLiked(data.post.liked)
      setLikesCount(data.post.likesCount)
    }
  }, [data])

  if (isLoading || !data) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-md" />
      </div>
    )
  }

  const { post } = data
  const beta = post.beta
  if (!beta) return <div className="p-6 text-center text-muted-foreground">Beta no encontrada</div>

  const statusMeta = getBetaStatusMeta(beta.betaStatus)
  const screenshots = beta.screenshots ?? []
  // Algunas betas tienen cientos de capturas: se muestran 6 en grande y el
  // resto tras un botón (evita un scroll infinito dentro del detalle).
  const SHOWN_SHOTS = 6
  const visibleShots = showAllShots ? screenshots : screenshots.slice(0, SHOWN_SHOTS)
  const comments = commentsData?.comments ?? []
  const canInteract = isAuthed && !isGuest

  async function handleLike() {
    if (!canInteract) { openAuth('login'); return }
    if (liked) {
      setLiked(false); setLikesCount(c => c - 1)
      try { await postService.unlike(postId) } catch { setLiked(true); setLikesCount(c => c + 1) }
    } else {
      setLiked(true); setLikesCount(c => c + 1)
      try { await postService.like(postId) } catch { setLiked(false); setLikesCount(c => c - 1) }
    }
  }

  async function handleDownload() {
    // Abrir el modal de descarga (estilo itch.io pero más simple)
    setShowDownload(true)
  }

  async function handleSave() {
    if (!canInteract) { openAuth('login'); return }
    setSaved(!saved)
    try {
      if (saved) await postService.unsave(postId)
      else await postService.save(postId)
      toast.success(saved ? 'Eliminado de guardados' : 'Añadido a favoritos')
    } catch {
      setSaved(!saved)
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || !canInteract) return
    setSubmittingComment(true)
    try {
      await postService.addComment(postId, commentText.trim())
      setCommentText('')
      refetchComments()
      qc.invalidateQueries({ queryKey: ['posts'] })
    } catch (err: any) {
      toast.error(err.message || 'Error al comentar')
    } finally {
      setSubmittingComment(false)
    }
  }

  // Development timeline
  const timelineSteps = [
    { id: 'coming_soon', label: 'Anunciado', icon: Megaphone },
    { id: 'alpha', label: 'Alpha', icon: FlaskConical },
    { id: 'closed_beta', label: 'Beta Cerrada', icon: Lock },
    { id: 'open_beta', label: 'Beta Abierta', icon: Globe },
    { id: 'early_access', label: 'Acceso Anticipado', icon: Rocket },
    { id: 'ended', label: 'Lanzamiento', icon: Trophy },
  ]
  const currentStepIndex = timelineSteps.findIndex(s => s.id === beta.betaStatus)

  return (
    <div className="flex flex-col max-h-[90vh] overflow-hidden">
      {/* ===== Scrollable content ===== */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {/* ===== HERO ===== */}
        <div className="relative">
          {/* Cover background */}
          <div className={cn('h-48 sm:h-64 relative overflow-hidden bg-gradient-to-br', statusMeta.color)}>
            {beta.coverImage ? (
              <img src={beta.coverImage} alt={beta.title} className="absolute inset-0 w-full h-full object-contain p-3" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <img src="/logo-devplay.png" alt="DevPlay" className="h-12 w-12 opacity-40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />
          </div>

          {/* Close button */}
          <button
            onClick={() => useUIStore.getState().closePostDetail()}
            className="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur text-white hover:bg-black/70 transition"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <BetaStatusBadge status={beta.betaStatus} />
              {beta.version && (
                <span className="rounded-full bg-white/20 backdrop-blur px-2 py-0.5 text-[10px] font-bold">
                  {beta.version}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold drop-shadow-lg">{beta.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => { openProfile(post.author.id); useUIStore.getState().closePostDetail() }}>
                <UserAvatar username={post.author.username} avatar={post.author.avatar} size="sm" className="ring-2 ring-white/30" />
              </button>
              <button
                onClick={() => { openProfile(post.author.id); useUIStore.getState().closePostDetail() }}
                className="text-sm font-medium hover:underline"
              >
                @{post.author.username}
              </button>
            </div>
          </div>
        </div>

        {/* ===== Action buttons ===== */}
        <div className="flex gap-2 p-4 border-b border-border/40">
          {user?.id === post.author.id && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEdit(true)}
              className="rounded-full gap-1.5"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleDownload}
            className="btn-gradient-beta rounded-sm flex-1 gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Descargar beta</span>
            <span className="sm:hidden">Descargar</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleLike}
            className={cn('rounded-full gap-1.5', liked && 'text-wine-500 border-wine-500/30')}
          >
            <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
            {likesCount}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            className={cn('rounded-full', saved && 'text-amber-500 border-amber-500/30')}
          >
            <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowShare(true)}
            className="rounded-full"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* ===== Meta info ===== */}
        <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-border/40">
          {beta.genre && (
            <span className="rounded-full bg-wine-100 px-2.5 py-1 text-[10px] font-medium text-wine-700 dark:bg-wine-500/20 dark:text-wine-300">
              {beta.genre}
            </span>
          )}
          {beta.platforms && beta.platforms.length > 0 && (
            <span className="rounded-full bg-wine-100 px-2.5 py-1 text-[10px] font-medium text-wine-700 dark:bg-wine-500/20 dark:text-wine-300">
              {beta.platforms.join(', ')}
            </span>
          )}
          {beta.downloadType === 'DIRECT' ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              Archivo directo
            </span>
          ) : (
            <span className="rounded-full bg-wine-100 px-2.5 py-1 text-[10px] font-medium text-wine-700 dark:bg-wine-500/20 dark:text-wine-300">
              {beta.externalPlatform ?? 'Enlace externo'}
            </span>
          )}
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
            {beta.downloads} descargas
          </span>
        </div>

        {/* ===== Tags ===== */}
        {beta.tags && beta.tags.length > 0 && (
          <div className="px-4 py-3 flex flex-wrap gap-1 border-b border-border/40">
            {beta.tags.map(t => (
              <span key={t} className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* ===== Description ===== */}
        {beta.description && (
          <div className="px-4 py-3 border-b border-border/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Descripción</h3>
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{beta.description}</p>
          </div>
        )}

        {/* ===== Screenshots gallery — capturas GRANDES y completas (estilo itch.io), nada recortado ===== */}
        {screenshots.length > 0 && (
          <div className="px-4 py-3 border-b border-border/40">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Capturas de pantalla</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {screenshots.length} {screenshots.length === 1 ? 'captura' : 'capturas'} · clic para ampliar
              </span>
            </div>
            <div className="space-y-3">
              {visibleShots.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightbox({ urls: screenshots, index: idx })}
                  className="block w-full overflow-hidden rounded-lg glass cursor-zoom-in group relative"
                >
                  <img
                    src={url}
                    alt={`Captura ${idx + 1}`}
                    className="w-full max-h-[460px] object-contain bg-black/[0.04] transition-transform duration-200 group-hover:scale-[1.01]"
                    loading="lazy"
                  />
                  {/* Número de captura en la esquina */}
                  <span className="absolute top-2 left-2 rounded-full bg-black/50 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition">
                    {idx + 1} / {screenshots.length}
                  </span>
                </button>
              ))}
              {screenshots.length > SHOWN_SHOTS && !showAllShots && (
                <Button
                  variant="outline"
                  className="w-full rounded-full gap-1.5"
                  onClick={() => setShowAllShots(true)}
                >
                  <Monitor className="h-4 w-4" />
                  Ver todas las capturas ({screenshots.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ===== Development timeline ===== */}
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Cronología del desarrollo</h3>
          <div className="flex items-center justify-between gap-1">
            {timelineSteps.map((step, i) => {
              const isPast = i < currentStepIndex
              const isCurrent = i === currentStepIndex
              return (
                <div key={step.id} className="flex flex-col items-center gap-1 flex-1">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs transition',
                    isPast && 'bg-olive-500 text-white',
                    isCurrent && cn('bg-gradient-to-br text-white scale-110 shadow-lg', statusMeta.color),
                    !isPast && !isCurrent && 'bg-secondary text-muted-foreground'
                  )}>
                    {isPast ? <Check className="h-4 w-4" /> : <step.icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className={cn(
                    'text-[8px] text-center leading-tight',
                    isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'
                  )}>
                    {step.label}
                  </span>
                  {i < timelineSteps.length - 1 && (
                    <div className={cn('absolute h-0.5 hidden', isPast && 'bg-olive-500')} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ===== Technical info ===== */}
        {(beta.requirements || beta.installInstructions) && (
          <div className="px-4 py-3 border-b border-border/40 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Información técnica
            </h3>
            {beta.requirements && (
              <div className="glass rounded-md p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Requisitos del sistema</p>
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80">{beta.requirements}</pre>
              </div>
            )}
            {beta.installInstructions && (
              <div className="glass rounded-md p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Instrucciones de instalación</p>
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80">{beta.installInstructions}</pre>
              </div>
            )}
          </div>
        )}

        {/* ===== Changelog ===== */}
        {beta.changelog && (
          <div className="px-4 py-3 border-b border-border/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Notas de la versión
            </h3>
            <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80">{beta.changelog}</pre>
          </div>
        )}

        {/* ===== Comments ===== */}
        <div className="px-4 py-3">
          <h3 className="flex items-center gap-2 mb-3 font-semibold text-sm">
            <MessageCircle className="h-4 w-4" />
            Comentarios ({comments.length})
          </h3>

          {/* Comment list */}
          <div className="space-y-2.5 mb-3">
            {comments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Sé el primero en comentar</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <button onClick={() => { openProfile(c.user.id); useUIStore.getState().closePostDetail() }}>
                    <UserAvatar username={c.user.username} avatar={c.user.avatar} size="sm" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="glass rounded-lg rounded-tl-sm px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <button
                          onClick={() => { openProfile(c.user.id); useUIStore.getState().closePostDetail() }}
                          className="text-xs font-semibold hover:underline"
                        >
                          {c.user.username}
                        </button>
                        <TimeAgo date={c.createdAt} className="text-[10px]" />
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment input */}
          {canInteract ? (
            <form onSubmit={handleComment} className="flex gap-2">
              <UserAvatar username={user!.username} avatar={user!.avatar} size="sm" className="shrink-0" />
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escribe un comentario..."
                maxLength={1000}
                className="flex-1 rounded-full"
              />
              <Button type="submit" size="icon" disabled={!commentText.trim() || submittingComment} className="shrink-0 rounded-full">
                {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          ) : (
            <Button variant="outline" className="w-full rounded-full" onClick={() => openAuth('login')}>
              Inicia sesión para comentar
            </Button>
          )}
        </div>
      </div>

      {/* ===== Share Modal ===== */}
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        postId={postId}
        authorName={post.author.username}
        postContent={beta.title}
      />

      {/* ===== Edit Modal ===== */}
      <EditBetaModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        postId={postId}
        beta={beta}
        authorId={post.author.id}
      />

      {/* ===== Download Modal (estilo itch.io) ===== */}
      <DownloadBetaModal
        open={showDownload}
        onClose={() => setShowDownload(false)}
        postId={postId}
        beta={beta}
        authorName={post.author.username}
      />

      {/* ===== Lightbox ===== */}
      <AnimatePresence mode="wait">
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightbox(null)}
          >
            <button className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10" onClick={() => setLightbox(null)}>
              <X className="h-5 w-5" />
            </button>
            {lightbox.urls.length > 1 && (
              <>
                <button className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10" onClick={(e) => { e.stopPropagation(); setLightbox(prev => prev ? { ...prev, index: (prev.index - 1 + prev.urls.length) % prev.urls.length } : null) }}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10" onClick={(e) => { e.stopPropagation(); setLightbox(prev => prev ? { ...prev, index: (prev.index + 1) % prev.urls.length } : null) }}>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <motion.div key={lightbox.index} initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
              <img src={lightbox.urls[lightbox.index]} alt="Captura" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
              <p className="text-center text-white text-xs mt-2">{lightbox.index + 1} / {lightbox.urls.length}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
