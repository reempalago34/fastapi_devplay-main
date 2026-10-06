'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { securityService } from '@/services/security-service'
import { toast } from 'sonner'
import { Flag, X, Loader2, Mail, AlertOctagon, Ban, Drama, AlertTriangle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const REASONS: { id: string; label: string; icon: LucideIcon; desc: string }[] = [
  { id: 'spam', label: 'Spam', icon: Mail, desc: 'Contenido repetitivo o no deseado' },
  { id: 'harassment', label: 'Acoso', icon: AlertOctagon, desc: 'Comportamiento abusivo o intimidante' },
  { id: 'inappropriate', label: 'Inapropiado', icon: Ban, desc: 'Contenido ofensivo o inadecuado' },
  { id: 'impersonation', label: 'Suplantación', icon: Drama, desc: 'Finge ser otra persona' },
  { id: 'other', label: 'Otro', icon: AlertTriangle, desc: 'Otra razón' },
]

export function ReportModal({
  open,
  onClose,
  type,
  entityId,
}: {
  open: boolean
  onClose: () => void
  type: 'POST' | 'USER' | 'COMMENT' | 'BETA'
  entityId: string
}) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!reason) {
      toast.error('Selecciona un motivo')
      return
    }
    setLoading(true)
    try {
      await securityService.report({ type, entityId, reason, description: description.trim() || undefined })
      toast.success('Reporte enviado. Gracias por ayudar a mantener DevPlay seguro 🛡️')
      onClose()
      setReason('')
      setDescription('')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

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
                <Flag className="h-5 w-5 text-red-500" />
                <h2 className="font-bold text-sm">Reportar {type === 'USER' ? 'usuario' : type === 'COMMENT' ? 'comentario' : 'publicación'}</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">¿Por qué estás reportando esto?</p>
              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md border-2 p-2.5 text-left transition',
                      reason === r.id ? 'border-red-500 bg-red-500/10' : 'border-border hover:border-red-500/40'
                    )}
                  >
                    <r.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{r.label}</p>
                      <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium">Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Añade detalles sobre el problema..."
                  rows={2}
                  maxLength={500}
                  className="mt-0.5 w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t border-border/50">
              <Button variant="outline" onClick={onClose} className="rounded-full flex-1">Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !reason}
                className="rounded-full flex-1 bg-red-500 hover:bg-red-600 text-white gap-1.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                Enviar reporte
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
