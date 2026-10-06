'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { postService } from '@/services/devplay-service'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BarChart3,
  Plus,
  X,
  Loader2,
  Send,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Clock,
  Trash2,
} from 'lucide-react'
import { UserAvatar } from '@/components/devplay/shared/shared'
import { cn } from '@/lib/utils'

const MAX_OPTIONS = 8
const MIN_OPTIONS = 2

export function CreatePollModal() {
  const { createPollOpen, closeCreatePoll } = useUIStore()
  const { user } = useCurrentUser()
  const qc = useQueryClient()

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [closesAt, setClosesAt] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  function resetForm() {
    setQuestion('')
    setOptions(['', ''])
    setAllowMultiple(false)
    setClosesAt('')
  }

  function handleClose() {
    closeCreatePoll()
    // Reset tras cerrar para no mostrar datos viejos al reabrir
    setTimeout(resetForm, 200)
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return
    setOptions((o) => [...o, ''])
  }

  function removeOption(idx: number) {
    if (options.length <= MIN_OPTIONS) return
    setOptions((o) => o.filter((_, i) => i !== idx))
  }

  function moveOption(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= options.length) return
    setOptions((o) => {
      const copy = [...o]
      const tmp = copy[idx]
      copy[idx] = copy[next]
      copy[next] = tmp
      return copy
    })
  }

  function updateOption(idx: number, value: string) {
    setOptions((o) => o.map((v, i) => (i === idx ? value : v)))
  }

  const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0)
  const validQuestion = question.trim().length >= 3
  const canSubmit = validQuestion && cleanOptions.length >= MIN_OPTIONS && !submitting

  async function handleSubmit() {
    if (!validQuestion) {
      toast.error('La pregunta debe tener al menos 3 caracteres')
      return
    }
    if (cleanOptions.length < MIN_OPTIONS) {
      toast.error(`Necesitas al menos ${MIN_OPTIONS} opciones`)
      return
    }
    if (cleanOptions.length > MAX_OPTIONS) {
      toast.error(`Máximo ${MAX_OPTIONS} opciones`)
      return
    }
    if (closesAt) {
      const closeDate = new Date(closesAt)
      if (isNaN(closeDate.getTime()) || closeDate.getTime() < Date.now()) {
        toast.error('La fecha de cierre debe ser futura')
        return
      }
    }

    setSubmitting(true)
    try {
      await postService.create({
        type: 'POLL',
        content: question.trim(),
        poll: {
          question: question.trim(),
          options: cleanOptions,
          allowMultiple,
          ...(closesAt ? { closesAt: new Date(closesAt).toISOString() } : {}),
        },
      })
      toast.success('¡Encuesta publicada!')
      handleClose()
      qc.invalidateQueries({ queryKey: ['posts'] })
    } catch (err: any) {
      toast.error(err.message || 'Error al publicar la encuesta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={createPollOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="glass-strong max-w-lg rounded-lg max-h-[90vh] overflow-y-auto custom-scroll">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Crear encuesta</DialogTitle>
              <DialogDescription className="text-xs">
                Pregunta algo a la comunidad y observa los resultados en tiempo real
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User info */}
        <div className="flex items-center gap-3">
          {user && <UserAvatar username={user.username} avatar={user.avatar} size="md" className="shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.username}</p>
            <p className="text-[11px] text-muted-foreground">Encuesta pública</p>
          </div>
        </div>

        {/* Question */}
        <div className="space-y-1.5">
          <Label htmlFor="poll-question" className="text-xs font-semibold">
            Pregunta
          </Label>
          <Input
            id="poll-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Cuál es tu motor de juegos favorito?"
            maxLength={280}
            className="rounded-md text-sm"
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {question.length}/280
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">
              Opciones ({cleanOptions.length}/{MAX_OPTIONS})
            </Label>
            <span className="text-[10px] text-muted-foreground">Mínimo {MIN_OPTIONS}</span>
          </div>

          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div
                key={idx}
                className="group flex items-center gap-1.5 rounded-md bg-secondary/40 px-2 py-1.5 focus-within:bg-secondary/60 transition"
              >
                <div className="flex flex-col items-center text-muted-foreground/50">
                  <button
                    type="button"
                    onClick={() => moveOption(idx, -1)}
                    disabled={idx === 0}
                    className="hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
                    aria-label="Subir opción"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <GripVertical className="h-3 w-3" />
                  <button
                    type="button"
                    onClick={() => moveOption(idx, 1)}
                    disabled={idx === options.length - 1}
                    className="hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
                    aria-label="Bajar opción"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                  {idx + 1}
                </span>

                <Input
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  placeholder={`Opción ${idx + 1}`}
                  maxLength={120}
                  className="h-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                />

                {options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="text-muted-foreground/60 hover:text-destructive transition p-1"
                    aria-label="Eliminar opción"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir opción
            </button>
          )}
        </div>

        {/* Settings */}
        <div className="space-y-3 rounded-md bg-secondary/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold">Permitir múltiples votos</p>
              <p className="text-[10px] text-muted-foreground">
                Los usuarios pueden elegir varias opciones
              </p>
            </div>
            <Switch
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
              aria-label="Permitir múltiples votos"
            />
          </div>

          <div className="border-t border-border/40" />

          <div className="space-y-1.5">
            <Label htmlFor="poll-closes" className="text-xs font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Fecha de cierre (opcional)
            </Label>
            <Input
              id="poll-closes"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="h-9 rounded-lg text-sm"
            />
            {closesAt && (
              <button
                type="button"
                onClick={() => setClosesAt('')}
                className="text-[10px] text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="h-2.5 w-2.5" />
                Quitar fecha de cierre
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="rounded-full" disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-gradient-primary rounded-sm gap-1.5"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Publicando...</>
            ) : (
              <><Send className="h-4 w-4" /> Publicar encuesta</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
