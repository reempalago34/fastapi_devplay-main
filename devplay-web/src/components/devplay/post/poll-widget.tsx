'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pollService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { toast } from 'sonner'
import {
  BarChart3,
  Check,
  Lock,
  Users,
  Loader2,
  AlarmClock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Poll } from '@/types/devplay'

interface PollWidgetProps {
  postId: string
  poll: Poll | null
}

export function PollWidget({ postId, poll }: PollWidgetProps) {
  const qc = useQueryClient()
  const { user, isAuthed, isGuest } = useCurrentUser()
  const { openAuth } = useUIStore()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Siempre consultamos la encuesta fresca para tener contadores actualizados.
  // staleTime alto (1 min) para no generar demasiadas peticiones.
  const { data, isLoading } = useQuery({
    queryKey: ['poll', postId],
    queryFn: () => pollService.getPoll(postId),
    enabled: !!poll,
    staleTime: 60_000,
  })

  const livePoll: Poll | null = data?.poll ?? poll

  /* La API vota contra el id de la encuesta; `livePoll` ya lo tiene. */
  const voteMutation = useMutation({
    mutationFn: (optionIds: string[]) => pollService.vote(postId, optionIds, livePoll ?? undefined),
    onSuccess: (res) => {
      // Actualizar caché local inmediatamente
      qc.setQueryData(['poll', postId], res)
      // Refrescar feed para sincronizar otros lugares donde aparezca el post
      qc.invalidateQueries({ queryKey: ['posts'] })
      setSelectedIds([])
      toast.success('Voto registrado')
    },
    onError: (err: any) => {
      toast.error(err.message || 'No se pudo registrar tu voto')
    },
  })

  const isClosed = useMemo(() => {
    if (!livePoll?.closesAt) return false
    return new Date(livePoll.closesAt).getTime() < Date.now()
  }, [livePoll?.closesAt])

  if (!livePoll) return null

  const hasVoted = (livePoll.userVotedOptionIds?.length ?? 0) > 0
  const canVote = !!user && isAuthed && !isGuest && !isClosed && !hasVoted
  const totalVotes = livePoll.totalVotes ?? 0

  function toggleOption(optionId: string) {
    if (!livePoll) return
    if (!livePoll.allowMultiple) {
      setSelectedIds([optionId])
      return
    }
    setSelectedIds((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    )
  }

  function handleVote() {
    if (!user) {
      openAuth('login')
      return
    }
    if (selectedIds.length === 0) {
      toast.error('Selecciona una opción')
      return
    }
    voteMutation.mutate(selectedIds)
  }

  // Cuando el usuario aún no ha votado: mostrar botones seleccionables
  const showVotingButtons = canVote
  // Cuando ya votó o está cerrada: mostrar resultados con barras
  const showResults = hasVoted || isClosed

  return (
    <div className="mx-4 mb-3 card-peach rounded-lg overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2.5 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm break-words">{livePoll.question}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 py-0">
                <Users className="h-2.5 w-2.5" />
                {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
              </Badge>
              {livePoll.allowMultiple && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  Múltiple
                </Badge>
              )}
              {isClosed ? (
                <Badge className="text-[9px] gap-0.5 px-1.5 py-0 bg-wine-500/15 text-wine-600 dark:text-wine-300 hover:bg-wine-500/20">
                  <Lock className="h-2.5 w-2.5" />
                  Cerrada
                </Badge>
              ) : livePoll.closesAt ? (
                <Badge variant="outline" className="text-[9px] gap-0.5 px-1.5 py-0">
                  <AlarmClock className="h-2.5 w-2.5" />
                  Cierra {formatCloseDate(livePoll.closesAt)}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-1.5">
          {livePoll.options.map((opt, idx) => {
            const userVotedThis = livePoll.userVotedOptionIds?.includes(opt.id) ?? false
            const isSelected = selectedIds.includes(opt.id)
            const isLeading =
              showResults &&
              livePoll.options.length > 0 &&
              opt.voteCount === Math.max(...livePoll.options.map((o) => o.voteCount)) &&
              opt.voteCount > 0

            if (showVotingButtons) {
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleOption(opt.id)}
                  className={cn(
                    'group relative w-full flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/60 bg-background/40 hover:border-primary/40 hover:bg-secondary/40'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                      livePoll.allowMultiple ? 'rounded-[4px]' : 'rounded-full',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/70 text-transparent group-hover:border-primary/60'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{opt.text}</span>
                </button>
              )
            }

            // Resultados con barra de progreso
            return (
              <div
                key={opt.id}
                className={cn(
                  'relative overflow-hidden rounded-md border px-3 py-2.5 transition',
                  userVotedThis
                    ? 'border-primary/60 bg-primary/5'
                    : isLeading
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border/50 bg-background/40'
                )}
              >
                {/* Filled progress */}
                <motion.div
                  className={cn(
                    'absolute inset-y-0 left-0 z-0',
                    userVotedThis
                      ? 'bg-primary/15'
                      : isLeading
                      ? 'bg-primary/10'
                      : 'bg-secondary/60'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${opt.percentage}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
                <div className="relative z-10 flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                      userVotedThis
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/70 text-transparent'
                    )}
                  >
                    {userVotedThis && <Check className="h-3 w-3" />}
                  </span>
                  <span
                    className={cn(
                      'flex-1 truncate',
                      userVotedThis ? 'font-semibold' : 'font-medium'
                    )}
                  >
                    {opt.text}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums">
                    {opt.percentage}%
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {opt.voteCount}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Voting actions / footer */}
        {showVotingButtons ? (
          <div className="mt-3 flex items-center gap-2">
            <Button
              onClick={handleVote}
              disabled={voteMutation.isPending || selectedIds.length === 0}
              className="btn-gradient-primary rounded-sm gap-1.5 flex-1"
              size="sm"
            >
              {voteMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
              ) : (
                <>Votar{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}</>
              )}
            </Button>
            {selectedIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="rounded-full text-xs"
              >
                Limpiar
              </Button>
            )}
          </div>
        ) : !user ? (
          <button
            onClick={() => openAuth('login')}
            className="mt-3 w-full text-xs text-primary hover:underline"
          >
            Inicia sesión para votar
          </button>
        ) : isGuest ? (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Crea una cuenta para participar en la encuesta
          </p>
        ) : null}

        {isLoading && (
          <p className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Actualizando...
          </p>
        )}
      </div>
    </div>
  )
}

function formatCloseDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60000)
  const diffH = Math.round(diffMs / 3600000)
  const diffD = Math.round(diffMs / 86400000)

  if (diffMs <= 0) return 'pronto'
  if (Math.abs(diffMin) < 60) return `en ${diffMin} min`
  if (Math.abs(diffH) < 24) return `en ${diffH} h`
  if (Math.abs(diffD) < 7) return `en ${diffD} d`
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
