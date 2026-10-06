'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { securityService } from '@/services/security-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { toast } from 'sonner'
import {
  Shield, Key, Users, Lock, Trash2, AlertTriangle, Check, X,
  Eye, EyeOff, Smartphone, Monitor, LogOut, Loader2, Ban, Flag,
  Search, UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/devplay/shared/shared'
import { useUIStore } from '@/lib/stores'
import { UnblockConfirmDialog } from '@/components/devplay/modals/block-confirm-dialog'
import { DeleteAccountModal } from '@/components/devplay/modals/delete-account-modal'

export function SecurityPanel() {
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const { user, refresh, logoutGuest } = useCurrentUser()
  const qc = useQueryClient()

  const { data: blockedData, isLoading: blockedLoading } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => securityService.getBlocked(),
  })

  const { data: loginData } = useQuery({
    queryKey: ['login-events'],
    queryFn: () => securityService.getLoginEvents(),
  })

  async function togglePrivacy() {
    if (!user) return
    setPrivacyLoading(true)
    try {
      await securityService.setPrivacy(!user.isPrivate)
      await refresh()
      toast.success(user.isPrivate ? 'Perfil ahora público' : 'Perfil ahora privado (solo seguidores)')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setPrivacyLoading(false)
    }
  }

  const blocked = blockedData?.blocked ?? []
  const loginEvents = loginData?.events ?? []

  // Score de seguridad (0-100)
  const securityScore = (() => {
    let score = 40
    if (user && !user.isGuest) score += 30
    if (user?.isPrivate) score += 15
    // if 2FA enabled would add 15
    return Math.min(score, 100)
  })()

  return (
    <div className="space-y-4">
      {/* Score de seguridad */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-olive-400 to-sepia-500 text-white">
            <Shield className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Estado de seguridad</h3>
            <p className="text-[10px] text-muted-foreground">Protección de tu cuenta</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-olive-500">{securityScore}</p>
            <p className="text-[9px] text-muted-foreground">/ 100</p>
          </div>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${securityScore}%` }}
            transition={{ duration: 1 }}
            className="h-full bg-gradient-to-r from-olive-400 to-sepia-500"
          />
        </div>
      </div>

      {/* Contraseña */}
      <SecurityCard
        icon={Key}
        title="Contraseña"
        desc="Cambia tu contraseña regularmente"
        gradient="from-amber-400 to-bronze-500"
        action={
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowPasswordModal(true)}>
            Cambiar
          </Button>
        }
      />

      {/* Privacidad del perfil */}
      <SecurityCard
        icon={user?.isPrivate ? Lock : Eye}
        title="Privacidad del perfil"
        desc={user?.isPrivate ? 'Solo tus seguidores pueden ver tu perfil' : 'Tu perfil es visible para todos'}
        gradient="from-wine-400 to-wine-500"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={togglePrivacy}
            disabled={privacyLoading}
            className="rounded-full gap-1.5"
          >
            {privacyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user?.isPrivate ? <Eye className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {user?.isPrivate ? 'Hacer público' : 'Hacer privado'}
          </Button>
        }
      />

      {/* Dispositivos / Sesiones */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-wine-400 to-wine-500 text-white">
            <Monitor className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Sesiones recientes</h3>
            <p className="text-[10px] text-muted-foreground">Últimos accesos a tu cuenta</p>
          </div>
        </div>
        {loginEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Sin registros de inicio de sesión</p>
        ) : (
          <div className="space-y-2">
            {loginEvents.slice(0, 5).map((event: any) => (
              <div key={event.id} className="flex items-center gap-3 rounded-lg glass p-2">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  event.success ? 'bg-olive-100 text-olive-600 dark:bg-olive-500/20' : 'bg-red-100 text-red-600 dark:bg-red-500/20'
                )}>
                  {event.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {event.success ? 'Inicio de sesión correcto' : 'Intento fallido'}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {event.userAgent?.slice(0, 50) || 'Dispositivo desconocido'}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(event.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usuarios bloqueados (mejorado con búsqueda y ordenamiento) */}
      <BlockedUsersSection blocked={blocked} isLoading={blockedLoading} />

      {/* Zona de peligro */}
      <div className="glass-card border-2 border-red-500/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-wine-600 text-white">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-500">Zona de peligro</h3>
            <p className="text-[10px] text-muted-foreground">Acciones irreversibles</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full rounded-full text-red-500 border-red-500/30 hover:bg-red-500/10 gap-1.5"
          onClick={() => setShowDeleteModal(true)}
        >
          <Trash2 className="h-4 w-4" />
          Eliminar mi cuenta
        </Button>
      </div>

      {/* Modales */}
      <AnimatePresence>
        {showPasswordModal && (
          <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
        )}
        {showDeleteModal && (
          <DeleteAccountModal onClose={() => setShowDeleteModal(false)} onDeleted={logoutGuest} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ===== Card de seguridad =====
function SecurityCard({
  icon: Icon, title, desc, gradient, action,
}: {
  icon: any; title: string; desc: string; gradient: string; action: React.ReactNode
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm', gradient)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[10px] text-muted-foreground line-clamp-1">{desc}</p>
      </div>
      {action}
    </div>
  )
}

// ===== Sección de usuarios bloqueados (mejorada) =====
function BlockedUsersSection({ blocked, isLoading }: { blocked: any[]; isLoading: boolean }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date')
  const [unblockTarget, setUnblockTarget] = useState<any>(null)

  // Filtrar y ordenar
  const filtered = blocked
    .filter(u => u.username.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.username.localeCompare(b.username)
      return new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime()
    })

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-wine-500 to-wine-700 text-white">
          <Ban className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold">Usuarios bloqueados</h3>
          <p className="text-[10px] text-muted-foreground">{blocked.length} bloqueado(s)</p>
        </div>
        {blocked.length > 0 && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
            className="text-[10px] rounded-full border border-input bg-transparent px-2 py-1 focus:outline-none"
          >
            <option value="date">Por fecha</option>
            <option value="name">Por nombre</option>
          </select>
        )}
      </div>

      {/* Buscador */}
      {blocked.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar bloqueados..."
            className="w-full rounded-full border border-input bg-transparent pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : blocked.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-olive-100 dark:bg-olive-500/20">
            <Check className="h-6 w-6 text-olive-500" />
          </div>
          <p className="text-sm font-semibold">No tienes usuarios bloqueados</p>
          <p className="text-xs text-muted-foreground mt-1">Cuando bloquees a alguien, aparecerá aquí</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Sin resultados para "{search}"</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u: any) => (
            <BlockedUserCard key={u.id} user={u} onUnblock={() => setUnblockTarget(u)} />
          ))}
        </div>
      )}

      {/* Confirmación de desbloqueo */}
      <UnblockConfirmDialog
        open={!!unblockTarget}
        onClose={() => setUnblockTarget(null)}
        userId={unblockTarget?.id ?? ''}
        username={unblockTarget?.username ?? ''}
        avatar={unblockTarget?.avatar ?? null}
        onUnblocked={() => setUnblockTarget(null)}
      />
    </div>
  )
}

// ===== Card de usuario bloqueado =====
function BlockedUserCard({ user, onUnblock }: { user: any; onUnblock: () => void }) {
  const { openProfile } = useUIStore()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)

  async function handleUnblock() {
    setLoading(true)
    try {
      await securityService.unblock(user.id)
      qc.invalidateQueries({ queryKey: ['blocked-users'] })
      toast.success(`@${user.username} desbloqueado`)
      onUnblock()
    } catch {
      toast.error('Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md glass p-2.5">
      <button onClick={() => openProfile(user.id)} className="shrink-0">
        <UserAvatar username={user.username} avatar={user.avatar} size="md" />
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={() => openProfile(user.id)} className="block text-left">
          <p className="text-sm font-semibold truncate">{user.username}</p>
          <p className="text-[10px] text-muted-foreground">
            Bloqueado {new Date(user.blockedAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </button>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleUnblock}
        disabled={loading}
        className="rounded-full text-xs h-7 shrink-0 gap-1"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
        Desbloquear
      </Button>
    </div>
  )
}

// ===== Modal: Cambiar contraseña =====
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const strength = getStrength(newPass)

  async function handleSubmit() {
    if (!current || !newPass || !confirm) {
      toast.error('Completa todos los campos')
      return
    }
    if (newPass !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (strength.score < 2) {
      toast.error('Contraseña demasiado débil')
      return
    }
    setLoading(true)
    try {
      await securityService.changePassword(current, newPass)
      toast.success('Contraseña cambiada correctamente')
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="glass-strong w-full max-w-md rounded-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Key className="h-5 w-5 text-amber-500" />
          Cambiar contraseña
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Introduce tu contraseña actual y la nueva</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Contraseña actual</label>
            <input
              type={show ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Nueva contraseña</label>
            <input
              type={show ? 'text' : 'password'}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Mínimo 6 caracteres"
            />
            {newPass && <StrengthMeter strength={strength} />}
          </div>
          <div>
            <label className="text-xs font-medium">Confirmar nueva contraseña</label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Repite la nueva contraseña"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Mostrar contraseñas
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onClose} className="rounded-full flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="btn-gradient-primary rounded-sm flex-1">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Cambiando...</> : 'Cambiar contraseña'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ===== Indicador de fortaleza =====
export function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const labels = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte', 'Muy fuerte']
  const colors = ['bg-red-500', 'bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-olive-400', 'bg-olive-500']

  return { score, label: labels[score] || 'Muy débil', color: colors[score] || 'bg-red-500' }
}

function StrengthMeter({ strength }: { strength: { score: number; label: string; color: string } }) {
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div
            key={i}
            className={cn('h-1 flex-1 rounded-full transition-all', i <= strength.score ? strength.color : 'bg-secondary')}
          />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{strength.label}</p>
    </div>
  )
}
