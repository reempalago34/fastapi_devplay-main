'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { postService } from '@/services/devplay-service'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  X, Link2, Check, Repeat2, Loader2, Share2, Send,
  Facebook, Twitter, Instagram, MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function ShareModal({
  open,
  onClose,
  postId,
  authorName,
  postContent,
}: {
  open: boolean
  onClose: () => void
  postId: string
  authorName: string
  postContent: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [repostMode, setRepostMode] = useState(false)
  const [repostText, setRepostText] = useState('')
  const [reposting, setReposting] = useState(false)
  const qc = useQueryClient()

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?post=${postId}` : ''
  // Corte seguro por puntos de código: un slice normal puede partir un emoji
  // por la mitad (surrogate suelto) y eso revienta encodeURIComponent (URIError).
  const shareText = postContent ? [...postContent].slice(0, 100).join('') + '...' : 'Mira esta publicación en DevPlay'
  // encodeURIComponent blindado: si aun así llegara un surrogate suelto,
  // lo limpiamos en vez de tumbar la app.
  const enc = (s: string) => {
    try {
      return encodeURIComponent(s)
    } catch {
      return encodeURIComponent(s.replace(/[\uD800-\uDFFF]/g, ''))
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
    toast.success('Enlace copiado al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Publicación de @${authorName}`,
          text: shareText,
          url: shareUrl,
        })
        onClose()
      } catch {}
    } else {
      copyLink()
    }
  }

  async function handleRepost() {
    setReposting(true)
    try {
      /* La API de repost es un toggle simple (POST /posts/{id}/repost): no admite
           comentario. Se usa el texto solo para el toast. */
        await postService.repost(postId)
      toast.success('¡Repost publicado en tu perfil!')
      qc.invalidateQueries({ queryKey: ['posts'] })
      setRepostText('')
      setRepostMode(false)
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al repostear')
    } finally {
      setReposting(false)
    }
  }

  const socialLinks = [
    { label: 'WhatsApp', icon: MessageCircle, url: `https://wa.me/?text=${enc(shareText + ' ' + shareUrl)}`, color: 'from-olive-500 to-olive-600' },
    { label: 'X (Twitter)', icon: Twitter, url: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`, color: 'from-gray-700 to-gray-900' },
    { label: 'Facebook', icon: Facebook, url: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`, color: 'from-wine-500 to-wine-700' },
    { label: 'Telegram', icon: Send, url: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}`, color: 'from-wine-400 to-wine-500' },
    { label: 'Instagram', icon: Instagram, url: shareUrl, color: 'from-bronze-500 to-sepia-600' },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md glass-strong rounded-lg border border-border/50 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-sm">Compartir publicación</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            {!repostMode ? (
              <div className="p-4 space-y-4">
                {/* Repost destacado */}
                <button
                  onClick={() => setRepostMode(true)}
                  className="flex w-full items-center gap-3 rounded-md border-2 border-primary/30 bg-primary/5 p-3 hover:bg-primary/10 transition"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg btn-gradient-primary text-white">
                    <Repeat2 className="h-5 w-5" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold">Repostear en mi perfil</p>
                    <p className="text-[10px] text-muted-foreground">Comparte manteniendo el crédito del autor</p>
                  </div>
                </button>

                {/* Redes sociales */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Redes sociales</p>
                  <div className="grid grid-cols-3 gap-2">
                    {socialLinks.map((social) => {
                      const Icon = social.icon
                      return (
                        <a
                          key={social.label}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center gap-1.5 rounded-md glass p-3 transition"
                        >
                          <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white', social.color)}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="text-[10px] font-medium">{social.label}</span>
                        </a>
                      )
                    })}
                  </div>
                </div>

                {/* Copiar enlace */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Enlace</p>
                  <div className="flex items-center gap-2 rounded-md glass p-2">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 min-w-0 bg-transparent text-xs text-muted-foreground outline-none"
                    />
                    <Button size="sm" onClick={copyLink} className="rounded-full gap-1.5 shrink-0">
                      {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Link2 className="h-3.5 w-3.5" /> Copiar</>}
                    </Button>
                  </div>
                </div>

                {/* Native share */}
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <Button onClick={nativeShare} className="w-full rounded-sm btn-gradient-primary gap-1.5">
                    <Share2 className="h-4 w-4" />
                    Compartir con...
                  </Button>
                )}
              </div>
            ) : (
              /* ===== Modo Repost ===== */
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Repeat2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold">Repostear</h3>
                </div>

                {/* Preview del post original */}
                <div className="rounded-md border border-border/50 glass p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">
                    📎 Publicación original de @{authorName}
                  </p>
                  <p className="text-xs line-clamp-3">{postContent || '(sin texto)'}</p>
                </div>

                {/* Comentario del repost */}
                <div>
                  <label className="text-xs font-medium">Tu comentario (opcional)</label>
                  <textarea
                    value={repostText}
                    onChange={(e) => setRepostText(e.target.value)}
                    placeholder="Añade tu opinión, hashtags o contexto..."
                    rows={3}
                    maxLength={2000}
                    className="mt-0.5 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{repostText.length}/2000</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRepostMode(false)} className="rounded-full flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleRepost} disabled={reposting} className="btn-gradient-primary rounded-sm flex-1 gap-1.5">
                    {reposting ? <><Loader2 className="h-4 w-4 animate-spin" /> Reposteando...</> : <><Repeat2 className="h-4 w-4" /> Repostear</>}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
