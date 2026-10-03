'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
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
} from 'lucide-react'
import { api, type Post } from '@/lib/devplay-api'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { toast } from 'sonner'
import { UserAvatar, TimeAgo, LiveBadge, PlatformBadge, formatBytes } from './shared'
import { cn } from '@/lib/utils'

export function PostCard({ post, onChange }: { post: Post; onChange?: () => void }) {
  const { user, isAuthed, isGuest } = useCurrentUser()
  const { openAuth, openPostDetail, openProfile } = useUIStore()
  const [liked, setLiked] = useState(post.liked)
  const [likesCount, setLikesCount] = useState(post.likesCount)

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
      try {
        await api.unlike(post.id)
      } catch {
        setLiked(true)
        setLikesCount((c) => c + 1)
      }
    } else {
      setLiked(true)
      setLikesCount((c) => c + 1)
      try {
        await api.like(post.id)
      } catch {
        setLiked(false)
        setLikesCount((c) => c - 1)
      }
    }
  }

  async function handleBetaDownload() {
    if (!canInteract) {
      openAuth('login')
      return
    }
    /* La API registra la descarga y responde la URL, asi que es asincrona.
       Se pide la ficha de la beta (no el post) porque el endpoint de descarga
       va por id de beta: POST /betas/{beta_id}/download. */
    try {
      const betaId = post.beta?.id
      if (!betaId) throw new Error('Esta beta no tiene ficha de descarga')
      const res = await api.betaDownloadUrl(betaId)
      window.open(res.url, '_blank')
      toast.success('Descarga iniciada')
      onChange?.()
    } catch {
      toast.error('No se pudo iniciar la descarga')
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta publicación?')) return
    try {
      await api.deletePost(post.id)
      toast.success('Publicación eliminada')
      onChange?.()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <button onClick={() => openProfile(post.author.id)}>
          <UserAvatar username={post.author.username} avatar={post.author.avatar} size="md" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => openProfile(post.author.id)}
              className="font-semibold text-sm hover:underline truncate"
            >
              {post.author.username}
            </button>
            {post.author.role === 'DEV' && (
              <Badge variant="secondary" className="text-[9px] py-0 h-4">DEV</Badge>
            )}
          </div>
          <TimeAgo date={post.createdAt} />
        </div>
        {isAuthor && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-sm whitespace-pre-wrap break-words">{post.content}</p>
        </div>
      )}

      {/* Media */}
      {post.mediaUrls.length > 0 && (
        <div className={cn(
          'grid gap-1',
          post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
        )}>
          {post.mediaUrls.map((m, i) => (
            <div key={i} className="overflow-hidden bg-black/5">
              {m.kind === 'image' ? (
                <img
                  src={m.url}
                  alt=""
                  className="w-full max-h-[500px] object-cover"
                  loading="lazy"
                />
              ) : (
                <video
                  src={m.url}
                  controls
                  className="w-full max-h-[500px] object-contain bg-black"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stream embed */}
      {post.type === 'STREAM' && post.stream && (
        <StreamEmbed post={post} />
      )}

      {/* Beta section */}
      {post.type === 'BETA' && post.beta && (
        <BetaSection post={post} onDownload={handleBetaDownload} canInteract={canInteract} />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={cn('gap-1.5', liked && 'text-red-500')}
        >
          <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
          <span className="text-xs">{likesCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openPostDetail(post.id)}
          className="gap-1.5"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs">{post.commentsCount}</span>
        </Button>
        {post.type === 'BETA' && post.beta && (
          <Button variant="ghost" size="sm" className="gap-1.5" disabled>
            <Download className="h-4 w-4" />
            <span className="text-xs">{post.beta.downloads}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 ml-auto"
          onClick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}/?post=${post.id}`)
            toast.success('Enlace copiado')
          }}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
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
      <div className="p-3 bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary live-pulse" />
          <p className="font-semibold text-sm flex-1 truncate">{stream.title}</p>
        </div>
        <a
          href={stream.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Ver directo en {stream.platform}
        </a>
      </div>
    </div>
  )
}

function BetaSection({
  post,
  onDownload,
  canInteract,
}: {
  post: Post
  onDownload: () => void
  canInteract: boolean
}) {
  const beta = post.beta!
  return (
    <div className="mx-4 mb-3 glass rounded-md p-4 border-2 border-primary/20">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Gamepad2 className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm truncate">{beta.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{beta.description}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[9px] py-0 h-4">
              {beta.downloadType === 'DIRECT' ? 'Archivo directo' : 'Enlace externo'}
            </Badge>
            {beta.downloadType === 'DIRECT' && beta.fileSize && (
              <span>{formatBytes(beta.fileSize)}</span>
            )}
            <span>{beta.downloads} descargas</span>
          </div>
        </div>
      </div>
      <Button
        onClick={onDownload}
        className="w-full mt-3 gap-2"
        size="sm"
      >
        <Download className="h-4 w-4" />
        Probar Beta
        {!canInteract && <span className="text-[10px] opacity-70">(requiere cuenta)</span>}
      </Button>
    </div>
  )
}
