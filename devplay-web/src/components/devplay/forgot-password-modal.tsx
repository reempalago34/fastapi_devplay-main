'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/devplay-api'
import { toast } from 'sonner'
import {
  Mail, Loader2, ArrowLeft, CheckCircle2, Eye, EyeOff, Shield, Lock,
} from 'lucide-react'

/**
 * Recuperación de contraseña 🔑 — flujo con CÓDIGO real de 6 dígitos:
 *   1. Email → se envía el código al correo (SMTP real)
 *   2. Código + nueva contraseña → se restablece
 *   3. Pantalla de éxito
 */
export function ForgotPasswordModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const data = await api.forgotPassword(email)
      setSentTo(data.sent_to ?? data.sentTo ?? email)
      setCode('')
      setPassword('')
      setConfirmPassword('')
      setStep('reset')
      const demo = data.demo_code ?? data.demoCode
      if (demo) toast.info(`Modo demo (sin correo): tu código es ${demo}`)
      else toast.success('Código enviado a tu correo 📬')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.replace(/\D/g, '').length !== 6) {
      toast.error('Escribe los 6 dígitos del código')
      return
    }
    if (password.length < 6) {
      toast.error('La contraseña debe tener mínimo 6 caracteres')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      await api.resetPassword({ email, code: code.replace(/\D/g, ''), password })
      setStep('done')
      toast.success('¡Contraseña actualizada! 🔓')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setStep('email')
    setEmail(''); setCode(''); setPassword(''); setConfirmPassword('')
    setSentTo(''); setShowPass(false); setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="glass-strong max-w-md rounded-lg p-0 overflow-hidden border-border/60">
        <div className="px-6 pt-6 pb-6">
          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <button
                  onClick={handleClose}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mb-4"
                >
                  <ArrowLeft className="h-3 w-3" /> Volver a iniciar sesión
                </button>

                <div className="mb-4">
                  <h2 className="text-xl font-bold">¿Olvidaste tu contraseña?</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ingresa tu email y te enviaremos un <b>código de 6 dígitos</b> para restablecer tu contraseña.
                  </p>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        required
                        autoComplete="email"
                        className="rounded-md pl-10 h-11"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full btn-gradient-primary rounded-md h-11 font-semibold"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                    ) : (
                      'Enviar código de recuperación'
                    )}
                  </Button>
                </form>

                <p className="text-[10px] text-muted-foreground mt-4 text-center">
                  Si el email existe en nuestro sistema, recibirás un código real.
                  Por seguridad, no revelamos si un email está registrado.
                </p>
              </motion.div>
            )}

            {step === 'reset' && (
              <motion.div
                key="reset"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <button
                  onClick={() => setStep('email')}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mb-4"
                >
                  <ArrowLeft className="h-3 w-3" /> Cambiar email
                </button>

                <div className="mb-4 text-center">
                  <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-sm frame-double bg-secondary">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Escribe el código</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviamos un código de 6 dígitos a<br /><b className="text-foreground">{sentTo}</b>
                  </p>
                </div>

                <form onSubmit={handleResetSubmit} className="space-y-4">
                  {/* Código */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Código de recuperación</Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        className="rounded-md pl-10 pr-4 h-12 text-center text-xl font-bold tracking-[0.4em] font-mono"
                      />
                    </div>
                  </div>

                  {/* Nueva contraseña */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nueva contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className="rounded-md pl-10 pr-10 h-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Confirmar contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite tu contraseña"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className="rounded-md pl-10 h-11"
                      />
                    </div>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <p className="text-[10px] text-red-500">Las contraseñas no coinciden</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || password.length < 6 || password !== confirmPassword}
                    className="w-full btn-gradient-primary rounded-md h-11 font-semibold"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restableciendo...</>
                    ) : (
                      'Restablecer contraseña'
                    )}
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-olive-100 dark:bg-olive-500/20">
                  <CheckCircle2 className="h-8 w-8 text-olive-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">¡Contraseña actualizada!</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Tu nueva contraseña ya está lista. Inicia sesión con ella
                  (recuerda que DevPlay te pedirá un código por correo al entrar 🔐).
                </p>
                <Button
                  onClick={handleClose}
                  className="w-full btn-gradient-primary rounded-md h-11"
                >
                  Iniciar sesión
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===== Modal de Restablecer Contraseña (por enlace antiguo /?reset=token) =====
export function ResetPasswordModal({
  open,
  token,
  onClose,
}: {
  open: boolean
  token: string
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('La contraseña debe tener mínimo 6 caracteres')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      // Camino legacy: la API acepta { token, password } (o { email, code, password })
      await api.resetPassword({ token, password })
      setDone(true)
      toast.success('¡Contraseña actualizada!')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setPassword('')
    setConfirmPassword('')
    setDone(false)
    setLoading(false)
    onClose()
  }

  if (done) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="glass-strong max-w-md rounded-lg p-0 overflow-hidden">
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-olive-100 dark:bg-olive-500/20">
              <CheckCircle2 className="h-8 w-8 text-olive-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">¡Contraseña actualizada!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <Button
              onClick={handleClose}
              className="w-full btn-gradient-primary rounded-md h-11"
            >
              Iniciar sesión
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="glass-strong max-w-md rounded-lg p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Restablecer contraseña</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Ingresa tu nueva contraseña.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="rounded-md pr-10 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirmar contraseña</Label>
              <Input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                minLength={6}
                className="rounded-md h-11"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[10px] text-red-500">Las contraseñas no coinciden</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || password.length < 6 || password !== confirmPassword}
              className="w-full btn-gradient-primary rounded-md h-11 font-semibold"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Actualizando...</>
              ) : (
                'Restablecer contraseña'
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
