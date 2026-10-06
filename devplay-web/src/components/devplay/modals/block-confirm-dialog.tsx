'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { securityService } from '@/services/security-service'
import { UserAvatar } from '@/components/devplay/shared/shared'
import { toast } from 'sonner'
import { Ban, X, Loader2, AlertTriangle, Check } from 'lucide-react'

export function BlockConfirmDialog({
  open,
  onClose,
  userId,
  username,
  avatar,
  onBlocked,
}: {
  open: boolean
  onClose: () => void
  userId: string
  username: string
  avatar: string | null
  onBlocked?: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleBlock() {
    setLoading(true)
    try {
      await securityService.block(userId)
      toast.success(`@${username} ha sido bloqueado`)
      onBlocked?.()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al bloquear')
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-strong rounded-lg border border-border/50 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <h2 className="text-lg font-bold mb-1">¿Bloquear a @{username}?</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Esta persona no podrá comentar en tus publicaciones, reaccionar a tu contenido,
                ni enviarte solicitudes de seguimiento.
              </p>

              {/* User preview */}
              <div className="flex items-center gap-3 rounded-md glass p-3 mb-4">
                <UserAvatar username={username} avatar={avatar} size="md" />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold truncate">{username}</p>
                  <p className="text-[10px] text-muted-foreground">Será bloqueado</p>
                </div>
                <Ban className="h-5 w-5 text-red-500 shrink-0" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-4 border-t border-border/50">
              <Button variant="outline" onClick={onClose} className="rounded-full flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleBlock}
                disabled={loading}
                className="rounded-full flex-1 bg-red-500 hover:bg-red-600 text-white gap-1.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                Sí, bloquear
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ===== Modal de confirmación para DESBLOQUEAR =====
export function UnblockConfirmDialog({
  open,
  onClose,
  userId,
  username,
  avatar,
  onUnblocked,
}: {
  open: boolean
  onClose: () => void
  userId: string
  username: string
  avatar: string | null
  onUnblocked?: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleUnblock() {
    setLoading(true)
    try {
      await securityService.unblock(userId)
      toast.success(`@${username} ha sido desbloqueado`)
      onUnblocked?.()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al desbloquear')
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-strong rounded-lg border border-border/50 shadow-xl overflow-hidden"
          >
            <div className="p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-olive-100 dark:bg-olive-500/20">
                <UserAvatar username={username} avatar={avatar} size="md" />
              </div>
              <h2 className="text-lg font-bold mb-1">¿Desbloquear a @{username}?</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Esta persona podrá volver a comentar en tus publicaciones, reaccionar a tu contenido
                y enviarte solicitudes de seguimiento.
              </p>
            </div>

            <div className="flex gap-2 p-4 border-t border-border/50">
              <Button variant="outline" onClick={onClose} className="rounded-full flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleUnblock}
                disabled={loading}
                className="rounded-sm flex-1 btn-gradient-primary gap-1.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Sí, desbloquear
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
