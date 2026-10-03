'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { securityService } from '@/services/security-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { toast } from 'sonner'
import { Loader2, Trash2, AlertTriangle, Mail, ShieldCheck, KeyRound, Check } from 'lucide-react'

/**
 * Flujo de eliminación de cuenta en 3 pasos:
 *  1. Pedir código al correo
 *  2. Escribir el código recibido
 *  3. Confirmar con la contraseña + frase "ELIMINAR MI CUENTA"
 */
export function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const { user } = useCurrentUser()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeVerified, setCodeVerified] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const isGuest = !!user?.isGuest

  async function requestCode() {
    setLoading(true)
    try {
      const res = await securityService.requestDeleteCode()
      setEmail(res.email)
      setDevCode(res.devCode ?? null)
      setStep(2)
      toast.success(res.devCode ? 'Modo demo: tu código está aquí abajo 👇' : 'Código enviado a tu correo')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    if (code.trim().length !== 6) {
      toast.error('El código tiene 6 dígitos')
      return
    }
    setLoading(true)
    try {
      await securityService.verifyDeleteCode(code.trim())
      setCodeVerified(true)
      setStep(3)
      toast.success('Código verificado')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!password) {
      toast.error('Escribe tu contraseña')
      return
    }
    setLoading(true)
    try {
      await securityService.confirmDeleteAccount(code.trim(), password, confirm)
      toast.success('Cuenta eliminada. Lamentamos verte partir')
      onDeleted()
      onClose()
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const stepsLabels = ['Código al correo', 'Verificar código', 'Contraseña']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="glass-strong w-full max-w-md rounded-lg p-5 border-2 border-red-500/30 max-h-[90vh] overflow-y-auto custom-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-5 w-5" />
          Eliminar cuenta
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Esta acción es <strong>irreversible</strong>. Se eliminarán tus posts, betas, comentarios, seguidores y datos personales.
        </p>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-1.5 mb-5">
          {stepsLabels.map((label, i) => {
            const current = step === i + 1
            const done = step > i + 1
            return (
              <div key={label} className="flex items-center gap-1.5 flex-1">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                    current
                      ? 'bg-red-500/15 text-red-500'
                      : done
                        ? 'bg-olive-500/15 text-olive-600 dark:text-olive-400'
                        : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                  <span className="hidden sm:inline truncate">{label}</span>
                </div>
                {i < stepsLabels.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            )
          })}
        </div>

        {isGuest ? (
          <div className="text-center py-4">
            <p className="text-sm font-semibold mb-1">Eres un invitado</p>
            <p className="text-xs text-muted-foreground mb-4">
              Las cuentas de invitado no tienen correo asociado. Cierra la sesión desde el menú de usuario.
            </p>
            <Button variant="outline" onClick={onClose} className="rounded-full">Entendido</Button>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <div className="rounded-md glass p-3 flex items-start gap-2.5">
              <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                Enviaremos un código de verificación de 6 dígitos a tu correo para confirmar que eres tú.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="rounded-full flex-1">Cancelar</Button>
              <Button onClick={requestCode} disabled={loading} className="rounded-sm flex-1 gap-1.5 bg-red-500 hover:bg-red-600 text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviar código
              </Button>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="space-y-4">
            <div className="rounded-md glass p-3 text-xs text-muted-foreground">
              Código enviado a <strong className="text-foreground">{email}</strong>. Caduca en 10 minutos.
            </div>
            {devCode && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <p className="font-semibold text-amber-600 dark:text-amber-400 mb-0.5">Modo demostración</p>
                <p className="text-muted-foreground">
                  Este entorno aún no envía correos reales (no hay SMTP configurado). Tu código es:{' '}
                  <span className="font-mono font-bold text-foreground tracking-widest">{devCode}</span>
                </p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Código de 6 dígitos</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="000000"
                className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-center font-mono text-lg tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={requestCode} disabled={loading} className="rounded-full flex-1 text-xs">
                Reenviar
              </Button>
              <Button onClick={verifyCode} disabled={loading || code.length !== 6} className="btn-gradient-primary rounded-sm flex-1 gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verificar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md glass p-3 flex items-center gap-2 text-xs text-olive-600 dark:text-olive-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Código verificado. Último paso: confirma con tu contraseña.
            </div>
            <div>
              <label className="text-xs font-medium flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Tu contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Escribe "ELIMINAR MI CUENTA" para confirmar</label>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="ELIMINAR MI CUENTA"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="rounded-full flex-1">Cancelar</Button>
              <Button
                onClick={handleDelete}
                disabled={loading || confirm !== 'ELIMINAR MI CUENTA' || !password}
                className="rounded-full flex-1 gap-1.5 bg-red-500 hover:bg-red-600 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
