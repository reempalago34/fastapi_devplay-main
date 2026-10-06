'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUIStore } from '@/lib/stores'
import { streamService } from '@/services/devplay-service'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/hooks/use-current-user'
import { toast } from 'sonner'
import { Radio, Twitch, Youtube, ExternalLink, Loader2, Video, Sparkles, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

const platforms = [
  {
    id: 'TWITCH',
    label: 'Twitch',
    icon: Twitch,
    urlHint: 'https://twitch.tv/tu-canal',
    color: 'from-wine-500 to-wine-600',
    emoji: '🟣',
  },
  {
    id: 'YOUTUBE',
    label: 'YouTube',
    icon: Youtube,
    urlHint: 'https://youtube.com/watch?v=...',
    color: 'from-red-500 to-wine-600',
    emoji: '🔴',
  },
  {
    id: 'KICK',
    label: 'Kick',
    icon: Video,
    urlHint: 'https://kick.com/tu-canal',
    color: 'from-olive-500 to-olive-600',
    emoji: '🟢',
  },
]

export function GoLiveModal() {
  const { goLiveOpen, closeGoLive } = useUIStore()
  const { user } = useCurrentUser()
  const { refresh } = useCurrentUser()
  const qc = useQueryClient()
  const [platform, setPlatform] = useState('TWITCH')
  const [streamUrl, setStreamUrl] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedPlatform = platforms.find((p) => p.id === platform)!

  async function handleSubmit() {
    if (!streamUrl.trim() || !title.trim()) {
      toast.error('Completa la URL y el título')
      return
    }
    setSubmitting(true)
    try {
      await streamService.goLive({
        platform,
        streamUrl: streamUrl.trim(),
        title: title.trim(),
        content: content.trim() || undefined,
      })
      toast.success('¡Estás en vivo! Tus seguidores han sido notificados')
      setTitle('')
      setStreamUrl('')
      setContent('')
      closeGoLive()
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['streams'] })
      qc.invalidateQueries({ queryKey: ['live-streams-view'] })
      refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar el directo')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = streamUrl.trim() && title.trim() && !submitting

  return (
    <Dialog open={goLiveOpen} onOpenChange={(o) => !o && closeGoLive()}>
      <DialogContent className="glass-strong max-w-lg rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shadow-olive-400/30">
              <Radio className="h-5 w-5 live-pulse" />
            </div>
            <div>
              <DialogTitle className="text-lg">Iniciar Directo</DialogTitle>
              <DialogDescription className="text-xs">
                Tus seguidores recibirán una notificación al instante
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plataforma */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plataforma
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {platforms.map((p) => {
                const Icon = p.icon
                const active = platform === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={cn(
                      'group flex flex-col items-center gap-1.5 rounded-md border-2 p-3 cursor-pointer transition-all',
                      active
                        ? 'border-primary bg-primary/10 scale-105 shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-secondary/40'
                    )}
                  >
                    <span className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition',
                      p.color
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-semibold">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="stream-url" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              URL del directo
            </Label>
            <Input
              id="stream-url"
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder={selectedPlatform.urlHint}
              className="rounded-md"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Tu stream se mostrará embebido dentro de DevPlay
            </p>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="live-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Título del directo <span className="text-wine-500 normal-case">*</span>
            </Label>
            <Input
              id="live-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Desarrollando el jefe final en vivo | Pixel Quest"
              maxLength={120}
              className="rounded-md"
            />
            <p className="text-[10px] text-muted-foreground text-right">{title.length}/120</p>
          </div>

          {/* Mensaje */}
          <div className="space-y-1.5">
            <Label htmlFor="live-content" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mensaje para el feed <span className="normal-case text-muted-foreground/70">(opcional)</span>
            </Label>
            <Textarea
              id="live-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Hoy programo la IA del boss. ¡Únete y dame ideas!"
              rows={2}
              maxLength={2000}
              className="resize-none rounded-md"
            />
          </div>

          {/* Info de notificación */}
          <div className="flex items-center gap-2 rounded-md bg-olive-100/50 dark:bg-olive-500/10 p-2.5 text-[11px] text-olive-700 dark:text-olive-300">
            <Bell className="h-3.5 w-3.5 shrink-0" />
            <span>Tus seguidores recibirán una notificación push al instante</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeGoLive} className="rounded-full">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-gradient-live rounded-sm gap-1.5"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Iniciando...</>
            ) : (
              <><Radio className="h-4 w-4 live-pulse" /> Ir en vivo</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
