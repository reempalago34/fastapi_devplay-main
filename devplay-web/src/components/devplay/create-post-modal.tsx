'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { postService, uploadService } from '@/services/devplay-service'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ImagePlus, Video, X, Loader2, FileText, Send, Sparkles } from 'lucide-react'
import { UserAvatar } from '@/components/devplay/shared/shared'

export function CreatePostModal() {
  const { createPostOpen, closeCreatePost } = useUIStore()
  const { user } = useCurrentUser()
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [media, setMedia] = useState<{ url: string; kind: 'image' | 'video' }[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const kind = file.type.startsWith('video/') ? 'video' : 'image'
        const res = await uploadService.upload(file, 'media')
        setMedia((m) => [...m, { url: res.url, kind }])
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al subir archivo')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removeMedia(idx: number) {
    setMedia((m) => m.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!content.trim() && media.length === 0) {
      toast.error('Escribe algo o añade una imagen/video')
      return
    }
    setSubmitting(true)
    try {
      await postService.create({
        type: 'POST',
        content: content.trim() || null,
        media,
      })
      toast.success('¡Publicación creada!')
      setContent('')
      setMedia([])
      closeCreatePost()
      qc.invalidateQueries({ queryKey: ['posts'] })
    } catch (err: any) {
      toast.error(err.message || 'Error al publicar')
    } finally {
      setSubmitting(false)
    }
  }

  const charCount = content.length
  const maxChars = 2000

  return (
    <Dialog open={createPostOpen} onOpenChange={(o) => !o && closeCreatePost()}>
      <DialogContent className="glass-strong max-w-lg rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Crear publicación</DialogTitle>
              <DialogDescription className="text-xs">
                Comparte una idea, captura o novedad con la comunidad
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User info + textarea */}
        <div className="flex gap-3">
          {user && <UserAvatar username={user.username} avatar={user.avatar} size="md" className="shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-1.5">{user?.username}</p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`¿Qué quieres compartir, ${user?.username}?`}
              maxLength={maxChars}
              rows={4}
              className="resize-none rounded-md text-sm"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground text-right mt-1">
              {charCount}/{maxChars}
            </p>
          </div>
        </div>

        {/* Media preview */}
        {media.length > 0 && (
          <div className={media.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-2'}>
            {media.map((m, i) => (
              <div key={i} className="relative rounded-md overflow-hidden glass">
                {m.kind === 'image' ? (
                  <img src={m.url} alt="" className="w-full h-40 object-cover" />
                ) : (
                  <video src={m.url} className="w-full h-40 object-cover" controls />
                )}
                <button
                  onClick={() => removeMedia(i)}
                  className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90 transition"
                  aria-label="Eliminar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="cursor-pointer">
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFile} />
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent transition">
              <ImagePlus className="h-3.5 w-3.5 text-wine-500" />
              Imagen
            </span>
          </label>
          <label className="cursor-pointer">
            <input type="file" accept="video/*" className="hidden" onChange={handleFile} />
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent transition">
              <Video className="h-3.5 w-3.5 text-wine-500" />
              Video
            </span>
          </label>
          {uploading && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Subiendo...
            </span>
          )}
          {media.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {media.length} archivo{media.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" onClick={closeCreatePost} className="rounded-full">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading || (!content.trim() && media.length === 0)}
            className="btn-gradient-post rounded-sm gap-1.5"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Publicando...</>
            ) : (
              <><Send className="h-4 w-4" /> Publicar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
