'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/lib/stores'
import { postService, uploadService, betaService } from '@/services/devplay-service'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Upload,
  Link2,
  FileArchive,
  X,
  Loader2,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Image as ImageIcon,
  Settings2,
  Send,
  Tag,
  Monitor,
  Sparkles,
  Info,
} from 'lucide-react'
import { formatBytes } from '@/components/devplay/shared/shared'
import { cn } from '@/lib/utils'

const MAX_BETA_SIZE = 50 * 1024 * 1024 // 50 MB

const GENRES = [
  'Plataformas', 'RPG', 'Puzzle', 'Aventura', 'Shooter',
  'Estrategia', 'Terror', 'Carreras', 'Deportes', 'Simulación', 'Otro',
]

const PLATFORMS = ['PC', 'Mac', 'Linux', 'Android', 'iOS', 'Web']

import { BETA_STATUSES, type BetaStatus } from '@/types/devplay'

const COMMON_TAGS = ['2D', '3D', 'Pixel Art', 'Indie', 'Multiplayer', 'Singleplayer', 'Story Rich', 'Atmospheric', 'Difficult', 'Relaxing']

const EXTERNAL_PLATFORMS = [
  { id: 'Google Drive', icon: '📁', hint: 'Comparte el enlace público de tu carpeta/archivo' },
  { id: 'itch.io', icon: '🎮', hint: 'Pega la URL de tu página de itch.io' },
  { id: 'MediaFire', icon: '📂', hint: 'Enlace directo de descarga de MediaFire' },
  { id: 'Mega', icon: '💾', hint: 'Enlace público de Mega' },
  { id: 'GitHub', icon: '🐙', hint: 'Enlace a releases de GitHub' },
  { id: 'Otro', icon: '🔗', hint: 'Cualquier otra plataforma' },
]

const STEPS = [
  { id: 1, title: 'Información', icon: Gamepad2, desc: 'Datos básicos del juego' },
  { id: 2, title: 'Multimedia', icon: ImageIcon, desc: 'Portada y capturas' },
  { id: 3, title: 'Descarga', icon: Upload, desc: 'Archivo o enlace' },
  { id: 4, title: 'Detalles', icon: Settings2, desc: 'Requisitos e instalación' },
]

export function CreateBetaModal() {
  const { createBetaOpen, closeCreateBeta } = useUIStore()
  const qc = useQueryClient()

  const [step, setStep] = useState(1)

  // Paso 1: Información
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('Plataformas')
  const [version, setVersion] = useState('')
  const [description, setDescription] = useState('')
  const [betaStatus, setBetaStatus] = useState<BetaStatus>('open_beta')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['PC'])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Paso 2: Multimedia
  const [coverImage, setCoverImage] = useState<string>('')
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingShots, setUploadingShots] = useState(false)

  // Paso 3: Descarga
  const [downloadType, setDownloadType] = useState<'DIRECT' | 'LINK'>('DIRECT')
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [externalUrl, setExternalUrl] = useState('')
  const [externalPlatform, setExternalPlatform] = useState('Google Drive')

  // Paso 4: Detalles
  const [requirements, setRequirements] = useState('')
  const [installInstructions, setInstallInstructions] = useState('')
  const [changelog, setChangelog] = useState('')
  const [feedMessage, setFeedMessage] = useState('')

  const [submitting, setSubmitting] = useState(false)

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }
  function toggleTag(t: string) {
    setSelectedTags((prev) => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadingCover(true)
    try {
      const res = await uploadService.upload(f, 'media')
      setCoverImage(res.url)
      toast.success('Portada subida')
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

    // Validar límite de 10 capturas
    if (screenshots.length + files.length > 10) {
      toast.error(`Máximo 10 capturas. Ya tienes ${screenshots.length}, intentas subir ${files.length}.`)
      e.target.value = ''
      return
    }

    setUploadingShots(true)
    try {
      for (const f of files) {
        const res = await uploadService.upload(f, 'media')
        setScreenshots((prev) => [...prev, res.url])
      }
      toast.success(`${files.length} captura(s) subida(s)`)
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setUploadingShots(false)
      e.target.value = ''
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_BETA_SIZE) {
      toast.error('El archivo pesa más de 50MB. Usa la opción de enlace externo.', {
        description: `Tamaño: ${formatBytes(f.size)}`,
        duration: 5000,
      })
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      const res = await uploadService.upload(f, 'beta')
      setFile(f)
      setFileName(res.originalName)
      setFileSize(f.size)
      toast.success('Archivo subido correctamente')
    } catch (err: any) {
      toast.error(err.message || 'Error al subir el archivo')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function clearFile() {
    setFile(null)
    setFileName(null)
    setFileSize(null)
  }

  function canAdvance(): boolean {
    if (step === 1) return title.trim().length >= 3 && description.trim().length > 0
    if (step === 2) return true // opcional
    if (step === 3) {
      if (downloadType === 'DIRECT') return !!file
      if (downloadType === 'LINK') return externalUrl.trim().length > 0
    }
    if (step === 4) return true
    return false
  }

  function resetAll() {
    setStep(1)
    setTitle(''); setGenre('Plataformas'); setVersion(''); setDescription(''); setBetaStatus('open_beta')
    setSelectedPlatforms(['PC']); setSelectedTags([])
    setCoverImage(''); setScreenshots([])
    setDownloadType('DIRECT')
    setFile(null); setFileName(null); setFileSize(null)
    setExternalUrl(''); setExternalPlatform('Google Drive')
    setRequirements(''); setInstallInstructions(''); setChangelog(''); setFeedMessage('')
  }

  async function handleSubmit() {
    if (!canAdvance()) {
      toast.error('Completa los campos requeridos')
      return
    }

    // Validar URL en el cliente
    if (downloadType === 'LINK' && externalUrl.trim()) {
      try {
        const url = new URL(externalUrl.trim())
        if (!['http:', 'https:'].includes(url.protocol)) {
          toast.error('La URL debe empezar con http:// o https://')
          return
        }
      } catch {
        toast.error('URL inválida. Verifica el enlace.')
        return
      }
    }

    setSubmitting(true)
    try {
      /* Publicar una beta son DOS llamadas en FastAPI, no un post con campos extra:
         1. POST /posts       → crea el post que anuncia la beta.
         2. POST /betas       → cuelga la ficha (descarga, plataformas, tags...).
         El orden importa: la beta apunta al id del post. */
      const { post } = await postService.create({ content: feedMessage.trim() || null })

      await betaService.create({
        postId: post.id,
        title: title.trim(),
        description: description.trim(),
        downloadType,
        /* Sin endpoint de subida (M4) el archivo no tiene URL real todavia. */
        fileUrl: null,
        fileName,
        fileSize,
        externalUrl: downloadType === 'LINK' ? externalUrl.trim() : null,
        betaStatus,
        genre,
        version: version.trim() || null,
        platforms: selectedPlatforms,
        tags: selectedTags,
      })
      toast.success('¡Beta publicada! Los testers ya pueden probarla')
      resetAll()
      closeCreateBeta()
      qc.invalidateQueries({ queryKey: ['posts'] })
    } catch (err: any) {
      toast.error(err.message || 'Error al publicar la beta')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      closeCreateBeta()
      // reset después de cerrar
      setTimeout(resetAll, 300)
    }
  }

  return (
    <Dialog open={createBetaOpen} onOpenChange={handleClose}>
      <DialogContent className="glass-strong max-w-2xl max-h-[92vh] p-0 overflow-hidden rounded-lg">
        {/* Header con pasos */}
        <div className="border-b border-border/50 p-4 pb-3">
          <DialogTitle className="flex items-center gap-2 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold gradient-text-peach">Subir Beta</div>
              <DialogDescription className="text-xs">Paso {step} de {STEPS.length} · Comparte tu juego con la comunidad</DialogDescription>
            </div>
          </DialogTitle>

          {/* Stepper */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = step > s.id
              const active = step === s.id
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => s.id < step && setStep(s.id)}
                    disabled={s.id > step}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                      active && 'bg-gradient-to-r from-amber-400 to-bronze-500 text-white shadow-sm',
                      done && 'bg-olive-100 text-olive-700 dark:bg-olive-500/20 dark:text-olive-300 cursor-pointer',
                      !active && !done && 'text-muted-foreground'
                    )}
                  >
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                      active && 'bg-white/20',
                      done && 'bg-olive-500 text-white',
                      !active && !done && 'bg-secondary'
                    )}>
                      {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                    </span>
                    <span className="hidden sm:inline">{s.title}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn('h-0.5 flex-1 mx-1 rounded-full', step > s.id ? 'bg-olive-400' : 'bg-border')} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Body con scroll */}
        <div className="overflow-y-auto custom-scroll max-h-[60vh] p-4">
          <AnimatePresence mode="wait">
            {/* ===== Paso 1: Información ===== */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <SectionHeader icon={Gamepad2} title="Información básica" desc="Cuéntanos sobre tu juego" />

                <div className="space-y-1.5">
                  <Label htmlFor="beta-title" className="flex items-center gap-1">
                    Título del juego <span className="text-wine-500">*</span>
                  </Label>
                  <Input
                    id="beta-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Pixel Quest"
                    maxLength={100}
                    className="rounded-md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="beta-genre">Género</Label>
                    <select
                      id="beta-genre"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="beta-version">Versión</Label>
                    <Input
                      id="beta-version"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="v0.1, Alpha 1.2..."
                      maxLength={30}
                      className="rounded-md"
                    />
                  </div>
                </div>

                {/* Estado de la beta */}
                <div className="space-y-2">
                  <Label>Estado de la beta</Label>
                  <div className="flex flex-wrap gap-1.5">
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
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="beta-desc" className="flex items-center gap-1">
                    Descripción <span className="text-wine-500">*</span>
                  </Label>
                  <Textarea
                    id="beta-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe tu juego: historia, mecánicas, novedades de esta versión, controles..."
                    maxLength={2000}
                    rows={4}
                    className="resize-none rounded-md"
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{description.length}/2000</p>
                </div>

                {/* Plataformas */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Monitor className="h-3.5 w-3.5" /> Plataformas disponibles
                  </Label>
                  <div className="flex flex-wrap gap-2">
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

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Tags (opcional)
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
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
              </motion.div>
            )}

            {/* ===== Paso 2: Multimedia ===== */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <SectionHeader icon={ImageIcon} title="Multimedia" desc="Portada y capturas del juego (opcional)" />

                {/* Portada */}
                <div className="space-y-2">
                  <Label>Imagen de portada</Label>
                  {coverImage ? (
                    <div className="relative rounded-md overflow-hidden glass">
                      <img src={coverImage} alt="" className="w-full h-40 object-cover" />
                      <button
                        onClick={() => setCoverImage('')}
                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 hover:border-wine-400/50 transition">
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                      {uploadingCover ? (
                        <><Loader2 className="h-8 w-8 animate-spin text-wine-400" /><p className="text-sm text-muted-foreground">Subiendo...</p></>
                      ) : (
                        <>
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">Subir portada</p>
                          <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP — 16:9 recomendado</p>
                        </>
                      )}
                    </label>
                  )}
                </div>

                {/* Capturas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Capturas de pantalla</Label>
                    <span className={cn(
                      'text-[11px] font-medium',
                      screenshots.length >= 10 ? 'text-red-500' : 'text-muted-foreground'
                    )}>
                      {screenshots.length}/10
                    </span>
                  </div>
                  {screenshots.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-2">
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
                  <label className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed p-4 transition',
                    screenshots.length >= 10
                      ? 'opacity-50 pointer-events-none border-border'
                      : 'hover:border-wine-400/50'
                  )}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleScreenshotsUpload} disabled={screenshots.length >= 10} />
                    {uploadingShots ? (
                      <><Loader2 className="h-6 w-6 animate-spin text-wine-400" /><p className="text-xs text-muted-foreground">Subiendo...</p></>
                    ) : screenshots.length >= 10 ? (
                      <>
                        <Check className="h-6 w-6 text-olive-500" />
                        <p className="text-xs font-medium">Máximo alcanzado (10)</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <p className="text-xs font-medium">Añadir capturas</p>
                        <p className="text-[10px] text-muted-foreground">Máximo 10 · Puedes subir varias a la vez</p>
                      </>
                    )}
                  </label>
                </div>
              </motion.div>
            )}

            {/* ===== Paso 3: Descarga ===== */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <SectionHeader icon={Upload} title="Método de descarga" desc="¿Cómo descargarán los testers tu juego?" />

                {/* Selector de método */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDownloadType('DIRECT')}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-md border-2 p-4 transition',
                      downloadType === 'DIRECT'
                        ? 'border-amber-400 bg-amber-100/50 dark:bg-amber-500/15'
                        : 'border-border hover:border-amber-400/50'
                    )}
                  >
                    <Upload className="h-6 w-6 text-amber-500" />
                    <div className="text-center">
                      <p className="text-sm font-semibold">Archivo directo</p>
                      <p className="text-[10px] text-muted-foreground">Sube el archivo (máx 50 MB)</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDownloadType('LINK')}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-md border-2 p-4 transition',
                      downloadType === 'LINK'
                        ? 'border-wine-400 bg-wine-100/50 dark:bg-wine-500/15'
                        : 'border-border hover:border-wine-400/50'
                    )}
                  >
                    <Link2 className="h-6 w-6 text-wine-500" />
                    <div className="text-center">
                      <p className="text-sm font-semibold">Enlace externo</p>
                      <p className="text-[10px] text-muted-foreground">Google Drive, itch.io, Mega...</p>
                    </div>
                  </button>
                </div>

                {/* Archivo directo */}
                {downloadType === 'DIRECT' && (
                  <div className="space-y-2">
                    {file ? (
                      <div className="glass flex items-center gap-3 rounded-md p-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-bronze-500 text-white">
                          <FileArchive className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{fileName}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(fileSize)}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearFile} className="h-8 w-8 rounded-full">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 hover:border-wine-400/50 transition">
                        <input type="file" accept=".zip,.rar,.7z,.tar,.gz,.exe,.apk" className="hidden" onChange={handleFile} />
                        {uploading ? (
                          <><Loader2 className="h-8 w-8 animate-spin text-wine-400" /><p className="text-sm text-muted-foreground">Subiendo...</p></>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm font-medium">Haz clic para subir tu juego</p>
                            <p className="text-[10px] text-muted-foreground">ZIP, RAR, 7Z, EXE, APK — Máximo 50 MB</p>
                          </>
                        )}
                      </label>
                    )}
                    <div className="flex items-start gap-2 rounded-lg bg-amber-100/60 dark:bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Regla de negocio: archivos &gt; 50MB deben usar enlace externo. El servidor validará el tamaño.</span>
                    </div>
                  </div>
                )}

                {/* Enlace externo */}
                {downloadType === 'LINK' && (
                  <div className="space-y-3">
                    {/* Selector de plataforma externa */}
                    <div className="space-y-2">
                      <Label>¿Dónde está alojado tu juego?</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {EXTERNAL_PLATFORMS.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setExternalPlatform(p.id)}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition',
                              externalPlatform === p.id
                                ? 'border-wine-400 bg-wine-100/50 dark:bg-wine-500/15'
                                : 'border-border hover:border-wine-400/50'
                            )}
                          >
                            <span className="text-xl">{p.icon}</span>
                            <span className="text-[10px] font-medium text-center">{p.id}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {EXTERNAL_PLATFORMS.find(p => p.id === externalPlatform)?.hint}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ext-url" className="flex items-center gap-1">
                        URL de descarga <span className="text-wine-500">*</span>
                      </Label>
                      <Input
                        id="ext-url"
                        type="url"
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        placeholder="https://..."
                        className="rounded-md"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Los testers serán redirigidos a esta URL al hacer clic en "Probar Beta"
                      </p>

                      {/* Alerta de baneo */}
                      <div className="flex items-start gap-2 rounded-md border-2 border-red-500/30 bg-red-500/5 p-3 mt-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                        <div className="text-[11px] text-red-600 dark:text-red-400">
                          <p className="font-bold">Advertencia sobre enlaces</p>
                          <p className="mt-0.5">
                            Solo agrega enlaces a contenido legítimo de tu juego. Las URLs que contengan
                            <strong> malware, phishing, contenido malicioso o inapropiado</strong> resultarán en
                            <strong> BANEO permanente</strong> de tu cuenta. El sistema valida automáticamente
                            que la URL sea real y accesible.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ===== Paso 4: Detalles ===== */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <SectionHeader icon={Settings2} title="Detalles técnicos" desc="Ayuda a los testers a probar tu juego" />

                <div className="space-y-1.5">
                  <Label htmlFor="req">Requisitos del sistema (opcional)</Label>
                  <Textarea
                    id="req"
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder={"SO: Windows 10\nRAM: 4 GB\nGPU: Cualquiera\nAlmacenamiento: 200 MB"}
                    rows={4}
                    className="resize-none rounded-md font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="install">Instrucciones de instalación (opcional)</Label>
                  <Textarea
                    id="install"
                    value={installInstructions}
                    onChange={(e) => setInstallInstructions(e.target.value)}
                    placeholder={"1. Descarga el archivo .zip\n2. Extrae la carpeta\n3. Ejecuta juego.exe\n4. ¡A jugar!"}
                    rows={4}
                    className="resize-none rounded-md text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="changelog">Notas de la versión / Changelog (opcional)</Label>
                  <Textarea
                    id="changelog"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder={"- Añadido nuevo jefe final\n- Corregido bug del inventario\n- Mejorados los gráficos"}
                    rows={4}
                    className="resize-none rounded-md text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="feed-msg">Mensaje para el feed (opcional)</Label>
                  <Textarea
                    id="feed-msg"
                    value={feedMessage}
                    onChange={(e) => setFeedMessage(e.target.value)}
                    placeholder="¡Probadores! Esta build trae un nuevo jefe final. Necesito feedback sobre la dificultad..."
                    rows={3}
                    className="resize-none rounded-md"
                  />
                </div>

                {/* Resumen */}
                <div className="card-rose rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Info className="h-3.5 w-3.5 text-wine-500" />
                    Resumen de tu beta
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div><b>{title || 'Sin título'}</b> {version && `· ${version}`}</div>
                    <div>{genre} · {selectedPlatforms.join(', ')}</div>
                    <div>{downloadType === 'DIRECT' ? 'Archivo directo' : externalPlatform}</div>
                    {selectedTags.length > 0 && <div>🏷️ {selectedTags.join(', ')}</div>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer con navegación */}
        <div className="border-t border-border/50 p-3 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => step === 1 ? handleClose(false) : setStep(step - 1)}
            className="rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </Button>

          <div className="flex items-center gap-1">
            {STEPS.map(s => (
              <span
                key={s.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  step === s.id ? 'w-6 bg-amber-400' : step > s.id ? 'w-1.5 bg-olive-400' : 'w-1.5 bg-border'
                )}
              />
            ))}
          </div>

          {step < STEPS.length ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className="btn-gradient-beta rounded-sm"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-gradient-beta rounded-sm"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Publicando...' : 'Publicar Beta'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SectionHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-bold text-sm">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}
