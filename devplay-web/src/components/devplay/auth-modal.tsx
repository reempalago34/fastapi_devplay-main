'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { authService, userService } from '@/services/devplay-service'
import { api } from '@/lib/devplay-api'
import { toast } from 'sonner'
import {
  Eye, EyeOff, Loader2, Mail, Lock, AtSign, Shield,
  Check, AlertCircle, Users, ArrowRight, ArrowBigUp, User, Cake,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ForgotPasswordModal } from '@/components/devplay/forgot-password-modal'

type FieldError = { field: string; message: string }

export function AuthModal() {
  const { authModalOpen, authMode, closeAuth, setView } = useUIStore()
  const { refreshAfterLogin, loginAsGuest } = useCurrentUser()
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(authMode)

  useEffect(() => {
    if (authModalOpen) setActiveTab(authMode)
  }, [authModalOpen, authMode])

  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [errors, setErrors] = useState<FieldError[]>([])
  const [showForgot, setShowForgot] = useState(false)

  // login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPass, setShowLoginPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [capsLockOn, setCapsLockOn] = useState(false)

  // register state
  const [regEmail, setRegEmail] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regFullName, setRegFullName] = useState('')
  const [regAge, setRegAge] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [showRegPass, setShowRegPass] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [usernameTaken, setUsernameTaken] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)

  // Paso 2 del registro: confirmar el correo con un código 🔐
  const [regCodeStep, setRegCodeStep] = useState(false)
  const [regCode, setRegCode] = useState('')
  const [regSentTo, setRegSentTo] = useState('')
  const [regResendLoading, setRegResendLoading] = useState(false)
  // Honeypot anti-bots 🍯: campo invisible pa' humanos. Si llega con contenido
  // al server, es un bot y se descarta en silencio.
  const [honeypot, setHoneypot] = useState('')

  // ===== Validaciones en tiempo real =====
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail || regEmail)
  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(regUsername)
  const usernameFree = usernameValid && !checkingUsername && !usernameTaken // disponible de verdad
  const fullNameValid = /^[\p{L}\p{N}][\p{L}\p{N} .'-]{1,29}$/u.test(regFullName.trim())
  const ageNum = parseInt(regAge, 10)
  const ageValid = Number.isInteger(ageNum) && ageNum >= 13 && ageNum <= 120
  const passwordStrength = getPasswordStrength(regPassword)

  // ===== Disponibilidad real del nombre de usuario (con espera) =====
  useEffect(() => {
    setUsernameTaken(false)
    if (!usernameValid) {
      setCheckingUsername(false)
      return
    }
    setCheckingUsername(true)
    const t = setTimeout(async () => {
      try {
        const res = await userService.getByUsername(regUsername)
        setUsernameTaken(!!res?.user)
      } catch {
        setUsernameTaken(false)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [regUsername, usernameValid])

  // Sugerencia amable: proponer usuario a partir del correo
  function suggestUsername() {
    if (!regUsername && regEmail.includes('@')) {
      const base = regEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16)
      if (base.length >= 3) setRegUsername(base)
    }
  }

  // (validaciones definidas arriba)

  function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
    let score = 0
    if (pwd.length >= 6) score++
    if (pwd.length >= 10) score++
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    const labels = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte', 'Muy fuerte']
    const colors = ['bg-red-500', 'bg-bronze-500', 'bg-amber-500', 'bg-lime-500', 'bg-olive-500', 'bg-olive-600']
    return { score, label: labels[score] || 'Muy débil', color: colors[score] || 'bg-red-500' }
  }

  function getFieldError(field: string): string | undefined {
    return errors.find(e => e.field === field)?.message
  }

  function clearFieldError(field: string) {
    setErrors(prev => prev.filter(e => e.field !== field))
  }

  function detectCapsLock(e: React.KeyboardEvent) {
    setCapsLockOn(!!e.getModifierState('CapsLock'))
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: FieldError[] = []
    if (!emailValid) newErrors.push({ field: 'loginEmail', message: 'Email inválido' })
    if (loginPassword.length < 1) newErrors.push({ field: 'loginPassword', message: 'Contraseña requerida' })
    if (newErrors.length) { setErrors(newErrors); return }

    setLoading(true)
    setErrors([])
    try {
      // Login DIRECTO con email + contraseña contra la API de FastAPI.
      // `api.login` guarda el JWT en localStorage y lanza ApiError si falla.
      try {
        await authService.login(loginEmail, loginPassword)
      } catch {
        setErrors([{ field: 'loginPassword', message: 'Email o contraseña incorrectos' }])
        return
      }
      toast.success('¡Bienvenido de vuelta! 🔓')
      setLoginEmail(''); setLoginPassword('')
      await refreshAfterLogin()
      closeAuth()
    } catch {
      setErrors([{ field: 'loginEmail', message: 'Error de conexión. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: FieldError[] = []
    if (!emailValid) newErrors.push({ field: 'regEmail', message: 'Email inválido' })
    if (!usernameValid) newErrors.push({ field: 'regUsername', message: '3-20 caracteres: letras, números y _' })
    else if (usernameTaken) newErrors.push({ field: 'regUsername', message: 'Ese nombre ya está en uso, prueba otro' })
    if (regPassword.length < 6) newErrors.push({ field: 'regPassword', message: 'Mínimo 6 caracteres' })
    if (!fullNameValid) newErrors.push({ field: 'regFullName', message: 'Escribe tu nombre de perfil (3-30 letras)' })
    if (!ageValid) newErrors.push({ field: 'regAge', message: regAge && ageNum < 13 ? 'Debes tener al menos 13 años para usar DevPlay' : 'Escribe tu edad (mínimo 13)' })
    if (!agreeTerms) newErrors.push({ field: 'terms', message: 'Debes aceptar los términos' })
    if (newErrors.length) { setErrors(newErrors); return }

    setLoading(true)
    setErrors([])
    try {
      /* `website` era el honeypot anti-bots de las rutas Prisma: se mandaba un campo
         invisible y si venia relleno se rechazaba el registro. La API de FastAPI
         no lo acepta (Pydantic lo ignoraria con error de campo extra), asi que
         la trampa se comprueba aqui antes de llamar. */
      if (honeypot) {
        setErrors([{ field: 'regEmail', message: 'Error de conexión. Intenta de nuevo.' }])
        setLoading(false)
        return
      }
      const data: any = await authService.register({ email: regEmail, username: regUsername, password: regPassword, fullName: regFullName.trim(), age: ageNum })
      // Paso 1 listo: la cuenta existe → pedir el código enviado al correo 📮
      setRegSentTo(data?.sentTo || 'tu correo')
      setRegCode('')
      setRegCodeStep(true)
      if (data?.demoCode) toast.info(`Modo demo (sin correo): tu código es ${data.demoCode}`)
      else toast.success(`¡Cuenta creada! Código enviado a ${data?.sentTo || 'tu correo'} 📬`)
    } catch (err: any) {
      setErrors([{ field: 'regEmail', message: err.message || 'Error al registrarse' }])
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyRegCode(e: React.FormEvent) {
    e.preventDefault()
    if (regCode.replace(/\D/g, '').length !== 6) {
      setErrors([{ field: 'regCode', message: 'Escribe los 6 dígitos del código' }])
      return
    }
    setLoading(true)
    setErrors([])
    try {
      await api.verifyRegister(regEmail, regCode.replace(/\D/g, ''))
      // Correo confirmado → abrimos sesión con email + contraseña
      try {
        await authService.login(regEmail, regPassword)
      } catch {
        setErrors([{ field: 'regCode', message: 'Correo confirmado, pero falló el acceso. Inicia sesión normal.' }])
        return
      }
      toast.success('¡Correo confirmado! Bienvenido a DevPlay 🎉')
      setRegEmail(''); setRegUsername(''); setRegPassword(''); setRegCode(''); setAgreeTerms(false)
      setRegCodeStep(false)
      await refreshAfterLogin()
      closeAuth()
    } catch {
      setErrors([{ field: 'regCode', message: 'Error de conexión. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  async function handleResendRegCode() {
    setRegResendLoading(true)
    try {
      const data = await api.resendRegisterCode(regEmail)
      setRegSentTo(data.sent_to ?? data.sentTo ?? regSentTo)
      setRegCode('')
      setErrors([])
      const demo = data.demo_code ?? data.demoCode
      if (demo) toast.info(`Modo demo: tu nuevo código es ${demo}`)
      else toast.success('Código reenviado 📬')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setRegResendLoading(false)
    }
  }

  function goToLoginFromReg() {
    setRegCodeStep(false)
    setRegCode('')
    setErrors([])
    setLoginEmail(regEmail)
    setActiveTab('login')
  }

  async function handleGuest() {
    setGuestLoading(true)
    try {
      await loginAsGuest()
      toast.success('Explorando como invitado')
      closeAuth()
    } catch {
      toast.error('Error al entrar como invitado')
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <Dialog open={authModalOpen} onOpenChange={(o) => !o && closeAuth()}>
      <DialogContent className="glass-strong max-w-md rounded-lg p-0 overflow-hidden border-border/60">
        {/* Título oculto: solo para lectores de pantalla */}
        <DialogTitle className="sr-only">{activeTab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</DialogTitle>
        {/* ===== Header con branding ===== */}
        <div className="relative px-6 pt-6 pb-4 text-center border-b border-border/40">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg">
              <img src="/logo-devplay.png" alt="DevPlay" className="h-10 w-10 rounded-md object-cover" />
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight text-foreground">DevPlay</h2>
            <p className="label-caps mt-1">
              Comunidad para devs de videojuegos indie
            </p>
          </div>
        </div>

        {/* ===== Tab switcher ===== */}
        <div className="px-6 pt-4">
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-secondary/50 p-1">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrors([]); setRegCodeStep(false) }}
              className={cn(
                'rounded-md py-2 text-sm font-semibold transition-all',
                activeTab === 'login'
                  ? 'btn-gradient-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setErrors([]); setRegCodeStep(false) }}
              className={cn(
                'rounded-md py-2 text-sm font-semibold transition-all',
                activeTab === 'register'
                  ? 'btn-gradient-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Crear cuenta
            </button>
          </div>
        </div>

        {/* ===== Formularios ===== */}
        <div className="px-6 pb-6 pt-4">
          <AnimatePresence mode="wait">
            {activeTab === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                {/* Email */}
                <FormField
                  label="Email"
                  icon={Mail}
                  error={getFieldError('loginEmail')}
                >
                  <Input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); clearFieldError('loginEmail') }}
                    placeholder="tu@email.com"
                    required
                    autoComplete="email"
                    className={cn(
                      'rounded-md pl-10 pr-4 h-11',
                      getFieldError('loginEmail') && 'border-red-500/50 focus-visible:ring-red-500/30'
                    )}
                  />
                </FormField>

                {/* Password */}
                <FormField
                  label="Contraseña"
                  icon={Lock}
                  error={getFieldError('loginPassword')}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowLoginPass(!showLoginPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                >
                  <Input
                    type={showLoginPass ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); clearFieldError('loginPassword') }}
                    onKeyDown={detectCapsLock}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className={cn(
                      'rounded-md pl-10 pr-10 h-11',
                      getFieldError('loginPassword') && 'border-red-500/50 focus-visible:ring-red-500/30'
                    )}
                  />
                </FormField>
                {capsLockOn && (
                  <p className="text-[10px] text-amber-500 flex items-center gap-1">
                    <ArrowBigUp className="h-3 w-3" /> Bloq Mayús activado
                  </p>
                )}

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} />
                    <span className="text-muted-foreground">Recuérdame</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-primary hover:underline font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-gradient-primary rounded-md h-11 font-semibold"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>
                  ) : (
                    <>Entrar <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </motion.form>
            ) : (
              regCodeStep ? (
                /* ===== Paso 2 del registro: confirmar correo 🔐 ===== */
                <motion.form
                  key="reg-code"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleVerifyRegCode}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-sm frame-double bg-secondary">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-display font-bold text-lg">Confirma tu correo</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Enviamos un código de 6 dígitos a<br /><b className="text-foreground">{regSentTo}</b>
                    </p>
                  </div>

                  <FormField label="Código de confirmación" icon={Shield} error={getFieldError('regCode')}>
                    <Input
                      value={regCode}
                      onChange={(e) => { setRegCode(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('regCode') }}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      className="rounded-md pl-10 pr-4 h-12 text-center text-xl font-bold tracking-[0.4em] font-mono"
                    />
                  </FormField>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-gradient-primary rounded-md h-11 font-semibold"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</>
                    ) : (
                      <>Confirmar y entrar <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={goToLoginFromReg}
                      className="text-muted-foreground hover:text-foreground font-medium"
                    >
                      ← Iniciar sesión
                    </button>
                    <button
                      type="button"
                      onClick={handleResendRegCode}
                      disabled={regResendLoading}
                      className="text-primary hover:underline font-medium disabled:opacity-50"
                    >
                      {regResendLoading ? 'Reenviando…' : 'Reenviar código'}
                    </button>
                  </div>
                </motion.form>
              ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                {/* Honeypot anti-bots 🍯 — invisible pa' humanos (aria-hidden +
                    tabIndex -1 + truco CSS position absolute fuera de vista).
                    Los bots de spam rellenan TODOS los inputs automáticamente. */}
                <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
                  <label htmlFor="reg-website">No llenes este campo</label>
                  <input
                    id="reg-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {/* Beneficios */}
                <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-muted-foreground bg-secondary/40 rounded-md py-2 px-3">
                  <span className="flex items-center gap-1"><Check className="h-3 w-3 text-olive-500" /> Gratis</span>
                  <span className="flex items-center gap-1"><Check className="h-3 w-3 text-olive-500" /> Publica y comparte</span>
                  <span className="flex items-center gap-1"><Check className="h-3 w-3 text-olive-500" /> Habla con Pixel 🤖</span>
                </div>

                {/* Email */}
                <FormField
                  label="Email"
                  icon={Mail}
                  error={getFieldError('regEmail')}
                  success={emailValid && regEmail.length > 0 ? 'Email válido' : undefined}
                >
                  <Input
                    type="email"
                    value={regEmail}
                    onChange={(e) => { setRegEmail(e.target.value); clearFieldError('regEmail') }}
                    placeholder="tu@email.com"
                    required
                    autoComplete="email"
                    className={cn(
                      'rounded-md pl-10 pr-10 h-11',
                      getFieldError('regEmail') && 'border-red-500/50 focus-visible:ring-red-500/30',
                      emailValid && regEmail.length > 0 && 'border-olive-500/50 focus-visible:ring-olive-500/30'
                    )}
                  />
                  {emailValid && regEmail.length > 0 && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-olive-500" />
                  )}
                </FormField>

                {/* Username */}
                <FormField
                  label="Nombre de usuario"
                  icon={AtSign}
                  error={getFieldError('regUsername') || (usernameTaken ? 'Ya en uso, prueba otro' : undefined)}
                  success={usernameFree ? 'Disponible' : undefined}
                >
                  <Input
                    value={regUsername}
                    onChange={(e) => { setRegUsername(e.target.value); clearFieldError('regUsername') }}
                    onBlur={suggestUsername}
                    placeholder="SuperCreador99"
                    pattern="[a-zA-Z0-9_]{3,20}"
                    required
                    autoComplete="username"
                    className={cn(
                      'rounded-md pl-10 pr-10 h-11',
                      (getFieldError('regUsername') || usernameTaken) && 'border-red-500/50 focus-visible:ring-red-500/30',
                      usernameFree && 'border-olive-500/50 focus-visible:ring-olive-500/30'
                    )}
                  />
                  {checkingUsername ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                  ) : usernameFree ? (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-olive-500" />
                  ) : null}
                </FormField>

                {/* Nombre de perfil */}
                <FormField
                  label="Nombre de perfil"
                  icon={User}
                  error={getFieldError('regFullName')}
                  success={fullNameValid ? '¡Qué buen nombre!' : undefined}
                >
                  <Input
                    value={regFullName}
                    onChange={(e) => { setRegFullName(e.target.value); clearFieldError('regFullName') }}
                    placeholder="¿Cómo quieres que te llamen?"
                    maxLength={30}
                    required
                    autoComplete="name"
                    className={cn(
                      'rounded-md pl-10 pr-10 h-11',
                      getFieldError('regFullName') && 'border-red-500/50 focus-visible:ring-red-500/30',
                      fullNameValid && 'border-olive-500/50 focus-visible:ring-olive-500/30'
                    )}
                  />
                  {fullNameValid && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-olive-500" />
                  )}
                </FormField>

                {/* Edad — declaración obligatoria (Ley 1581 Art. 7: menores de 13 no) 🎂 */}
                <FormField
                  label="Edad"
                  icon={Cake}
                  error={getFieldError('regAge')}
                  success={ageValid ? 'Perfecto' : undefined}
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={regAge}
                    onChange={(e) => { setRegAge(e.target.value); clearFieldError('regAge') }}
                    placeholder="Mínimo 13 años"
                    required
                    className={cn(
                      'rounded-md pl-10 pr-10 h-11',
                      getFieldError('regAge') && 'border-red-500/50 focus-visible:ring-red-500/30',
                      ageValid && 'border-olive-500/50 focus-visible:ring-olive-500/30'
                    )}
                  />
                  {ageValid && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-olive-500" />
                  )}
                </FormField>

                {/* Password */}
                <FormField
                  label="Contraseña"
                  icon={Lock}
                  error={getFieldError('regPassword')}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowRegPass(!showRegPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showRegPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                >
                  <Input
                    type={showRegPass ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => { setRegPassword(e.target.value); clearFieldError('regPassword') }}
                    onKeyDown={detectCapsLock}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                    autoComplete="new-password"
                    className={cn(
                      'rounded-md pl-10 pr-10 h-11',
                      getFieldError('regPassword') && 'border-red-500/50 focus-visible:ring-red-500/30'
                    )}
                  />
                </FormField>

                {/* Avisos FUERA del campo para no descuadrar los iconos 🎯 */}
                {capsLockOn && (
                  <p className="text-[10px] text-amber-500 flex items-center gap-1">
                    <ArrowBigUp className="h-3 w-3" /> Bloq Mayús activado
                  </p>
                )}
                {regPassword.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(i => (
                        <div
                          key={i}
                          className={cn(
                            'h-1 flex-1 rounded-full transition-colors',
                            i <= passwordStrength.score ? passwordStrength.color : 'bg-secondary'
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Fortaleza: <span className="font-medium">{passwordStrength.label}</span>
                    </p>
                  </div>
                )}

                {/* Terms */}
                <div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={agreeTerms}
                      onCheckedChange={(v) => { setAgreeTerms(!!v); clearFieldError('terms') }}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Acepto los <button type="button" onClick={() => { closeAuth(); setView('about') }} className="text-primary hover:underline">Términos de servicio</button> y la{' '}
                      <button type="button" onClick={() => { closeAuth(); setView('about') }} className="text-primary hover:underline">Política de privacidad</button>
                    </span>
                  </label>
                  {getFieldError('terms') && (
                    <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {getFieldError('terms')}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading || !agreeTerms}
                  className="w-full btn-gradient-primary rounded-md h-11 font-semibold"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>
                  ) : (
                    <>Crear cuenta <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </motion.form>
              )
            )}
          </AnimatePresence>

          {/* ===== Guest ===== */}
          <Button
            variant="outline"
            onClick={handleGuest}
            disabled={guestLoading}
            className="w-full rounded-md h-11 mt-3 gap-2"
          >
            {guestLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Explorar como invitado
          </Button>

          {/* ===== Security badge ===== */}
          <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-muted-foreground">
            <Shield className="h-3 w-3 text-olive-500" />
            <span>Tus datos están protegidos con cifrado</span>
          </div>
        </div>
      </DialogContent>

      {/* Modal de recuperar contraseña */}
      <ForgotPasswordModal open={showForgot} onClose={() => setShowForgot(false)} />
    </Dialog>
  )
}

// ===== FormField wrapper =====
function FormField({
  label,
  icon: Icon,
  error,
  success,
  trailing,
  children,
}: {
  label: string
  icon: any
  error?: string
  success?: string
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold flex items-center justify-between">
        <span>{label}</span>
        {success && (
          <span className="text-[10px] text-olive-500 flex items-center gap-0.5">
            <Check className="h-3 w-3" /> {success}
          </span>
        )}
      </Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {children}
        {trailing}
      </div>
      {error && (
        <p className="text-[10px] text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  )
}
