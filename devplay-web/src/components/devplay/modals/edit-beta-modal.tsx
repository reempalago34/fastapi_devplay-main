'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { betaService, uploadService } from '@/services/devplay-service'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/hooks/use-current-user'
import { toast } from 'sonner'
import {
  X, Loader2, Camera, Check, Upload, AlertTriangle, Settings2,
  FileText, Image as ImageIcon, Gamepad2, Save,
} from 'lucide-react'
import { BETA_STATUSES, type BetaStatus } from '@/types/devplay'
import { formatBytes } from '@/components/devplay/shared/shared'
import { cn } from '@/lib/utils'

const GENRES = ['Plataformas', 'RPG', 'Puzzle', 'Aventura', 'Shooter', 'Estrategia', 'Terror', 'Carreras', 'Deportes', 'Simulación', 'Otro']
const PLATFORMS = ['PC', 'Mac', 'Linux', 'Android', 'iOS', 'Web']
const COMMON_TAGS = ['2D', '3D', 'Pixel Art', 'Indie', 'Multiplayer', 'Singleplayer', 'Story Rich', 'Atmospheric', 'Difficult', 'Relaxing']

export function EditBetaModal({
  open,
  onClose,
  postId,
  beta,
  authorId,
}: {
  open: boolean
  onClose: () => void
  postId: string
  beta: any
  authorId: string
}) {
  const qc = useQueryClient()
  const { user } = useCurrentUser()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [feedMessage, setFeedMessage] = useState('')
  const [genre, setGenre] = useState('Plataformas')
  const [version, setVersion] = useState('')
  const [betaStatus, setBetaStatus] = useState<BetaStatus>('open_beta')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState('')
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [requirements, setRequirements] = useState('')
  const [installInstructions, setInstallInstructions] = useState('')
  const [changelog, setChangelog] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingShots, setUploadingShots] = useState(false)
  const [saving, setSaving] = useState(false)

  // Pre-fill form when beta data loads
  useEffect(() => {
    if (beta) {
      setTitle(beta.title ?? '')
      setDescription(beta.description ?? '')
      setGenre(beta.genre ?? 'Plataformas')
      setVersion(beta.version ?? '')
      setBetaStatus(beta.betaStatus ?? 'open_beta')
      setSelectedPlatforms(beta.platforms ?? ['PC'])
      setSelectedTags(beta.tags ?? [])
      setCoverImage(beta.coverImage ?? '')
      setScreenshots(beta.screenshots ?? [])
      setRequirements(beta.requirements ?? '')
      setInstallInstructions(beta.installInstructions ?? '')
      setChangelog(beta.changelog ?? '')
    }
  }, [beta])

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }
  function toggleTag(t: string) {
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadingCover(true)
    try {
      const res = await uploadService.upload(f, 'media')
      setCoverImage(res.url)
      toast.success('Portada actualizada')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setUploadingCover(false)
      e.target.value = ''
    }
  }

  async function handleScreenshotsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (screenshots.length + files.length > 10) {
      toast.error(`Máximo 10 capturas. Ya tienes ${screenshots.length}.`)
      e.target.value = ''
      return
    }
    setUploadingShots(true)
    try {
      for (const f of files) {
        const res = await uploadService.upload(f, 'media')
        setScreenshots(prev => [...prev, res.url])
      }
      toast.success(`${files.length} captura(s) subida(s)`)
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setUploadingShots(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (!title.trim() || !description.trim()) {
      toast.error('Título y descripción son obligatorios')
      return
    }
    setSaving(true)
    try {
      await betaService.edit(postId, {
        title: title.trim(),
        description: description.trim(),
        content: feedMessage.trim() || null,
        genre,
        version: version.trim() || null,
        betaStatus,
        platforms: selectedPlatforms,
        tags: selectedTags,
        coverImage: coverImage || null,
        screenshots,
        requirements: requirements.trim() || null,
        installInstructions: installInstructions.trim() || null,
        changelog: changelog.trim() || null,
      })
      toast.success('Beta actualizada correctamente')
      qc.invalidateQueries({ queryKey: ['post', postId] })
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['betas-view'] })
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="glass-strong w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scroll rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 glass-strong border-b border-border/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-bronze-500 text-white">
                  <Gamepad2 className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-sm">Editar Beta</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-5 space-y-5">
              {/* === Información general === */}
              <Section title="Información general" icon={FileText}>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Título</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-0.5 rounded-md" maxLength={100} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Género</Label>
                      <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Versión</Label>
                      <Input value={version} onChange={(e) => setVersion(e.target.value)} className="mt-0.5 rounded-md" maxLength={30} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Descripción</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className="mt-0.5 rounded-md resize-none" />
                    <p className="text-[10px] text-muted-foreground text-right">{description.length}/2000</p>
                  </div>
                  <div>
                    <Label className="text-xs">Mensaje del feed</Label>
                    <Textarea value={feedMessage} onChange={(e) => setFeedMessage(e.target.value)} rows={2} maxLength={2000} className="mt-0.5 rounded-md resize-none" placeholder="Mensaje opcional para el feed" />
                  </div>

                  {/* Estado */}
                  <div>
                    <Label className="text-xs">Estado de la beta</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {BETA_STATUSES.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setBetaStatus(s.id)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-[11px] font-medium transition',
                            betaStatus === s.id
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border hover:border-primary/40'
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* === Plataformas y tags === */}
              <Section title="Plataformas y tags" icon={Settings2}>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Plataformas</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {PLATFORMS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePlatform(p)}
                          className={cn(
                            'rounded-full border-2 px-3 py-1 text-xs font-medium transition',
                            selectedPlatforms.includes(p)
                              ? 'border-amber-400 bg-amber-100/50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'border-border hover:border-amber-400/50'
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Tags</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {COMMON_TAGS.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTag(t)}
                          className={cn(
                            'rounded-full border px-2.5 py-0.5 text-[11px] transition',
                            selectedTags.includes(t)
                              ? 'border-wine-400 bg-wine-100/50 text-wine-700 dark:bg-wine-500/20 dark:text-wine-300'
                              : 'border-border hover:border-wine-400/50'
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* === Multimedia === */}
              <Section title="Multimedia" icon={ImageIcon}>
                <div className="space-y-3">
                  {/* Cover */}
                  <div>
                    <Label className="text-xs">Portada</Label>
                    {coverImage ? (
                      <div className="relative rounded-md overflow-hidden glass mt-1">
                        <img src={coverImage} alt="" className="w-full h-28 object-cover" />
                        <button
                          onClick={() => setCoverImage('')}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border-2 border-dashed p-4 hover:border-primary/40 transition mt-1">
                        <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                        {uploadingCover ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
                        <span className="text-xs">Subir portada</span>
                      </label>
                    )}
                  </div>

                  {/* Screenshots */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Capturas</Label>
                      <span className={cn('text-[11px]', screenshots.length >= 10 ? 'text-red-500' : 'text-muted-foreground')}>
                        {screenshots.length}/10
                      </span>
                    </div>
                    {screenshots.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-2 mt-1">
                        {screenshots.map((s, i) => (
                          <div key={i} className="relative rounded-lg overflow-hidden glass aspect-video">
                            <img src={s} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => setScreenshots(prev => prev.filter((_, idx) => idx !== i))}
                              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {screenshots.length < 10 && (
                      <label className={cn(
                        'flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed p-3 transition mt-1',
                        'hover:border-wine-400/50'
                      )}>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleScreenshotsUpload} />
                        {uploadingShots ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                        <span className="text-xs">Añadir capturas ({screenshots.length}/10)</span>
                      </label>
                    )}
                  </div>
                </div>
              </Section>

              {/* === Info técnica === */}
              <Section title="Información técnica" icon={Settings2}>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Requisitos del sistema</Label>
                    <Textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={4} className="mt-0.5 rounded-md resize-none font-mono text-xs" placeholder="SO: Windows 10&#10;RAM: 4 GB&#10;GPU: Cualquiera" />
                  </div>
                  <div>
                    <Label className="text-xs">Instrucciones de instalación</Label>
                    <Textarea value={installInstructions} onChange={(e) => setInstallInstructions(e.target.value)} rows={3} className="mt-0.5 rounded-md resize-none text-xs" placeholder="1. Descarga el .zip&#10;2. Extrae&#10;3. Ejecuta" />
                  </div>
                  <div>
                    <Label className="text-xs">Notas de versión / Changelog</Label>
                    <Textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} rows={3} className="mt-0.5 rounded-md resize-none text-xs" placeholder="- Nuevo jefe final&#10;- Bug fix" />
                  </div>
                </div>
              </Section>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex gap-2 p-4 border-t border-border/50 glass-strong">
              <Button variant="outline" onClick={onClose} className="rounded-full flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="btn-gradient-beta rounded-sm flex-1 gap-1.5">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="h-4 w-4" /> Guardar cambios</>}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="glass rounded-md p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}
