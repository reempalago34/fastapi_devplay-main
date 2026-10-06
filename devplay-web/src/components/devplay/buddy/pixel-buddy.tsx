'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import {
  X, Send, Sparkles, MoreVertical, MessageSquarePlus, Trash2,
  Copy, Check, VolumeX, Volume2, Minimize2,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'
import type { ViewId } from '@/types/devplay'
import { api } from '@/lib/devplay-api'

/**
 * Pixel 🤖 — mascota de IA de DevPlay.
 * - Pequeño, visible en todas las secciones
 * - CAMINA de lado a lado por la pantalla con animación de caminata 🚶
 * - Se puede ARRASTRAR Y SOLTAR a cualquier parte 🤏
 * - MUCHA personalidad: humores, saltos, baile, guiños, se duerme 💤
 * - Guías paso a paso (publicar, subir beta, crear cuenta)
 * - SOLO devs registrados pueden hablarle (invitados → panel de registro)
 * - Menú ⋮: nuevo chat, eliminar, copiar, silenciar burbujas, minimizar
 */

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

type BuddyAction = { type: 'go' | 'gesture'; value: string }

const VALID_VIEWS = new Set<string>(['explore', 'discover', 'chat', 'profile', 'betas', 'store', 'about', 'reportes'])

type Mood = 'idle' | 'happy' | 'excited' | 'wink' | 'sleepy' | 'dizzy' | 'shocked'
type Emote = 'none' | 'jump' | 'dance' | 'land' | 'spin'

const PARTICLE_EMOJIS = ['✨', '🎮', '☕', '🚀', '👾', '💡', '❤️', '💫']
const WALK_SPEED = 70 // px por segundo
const FLOOR_Y = 12 // px desde el borde inferior: Pixel SIEMPRE vive en el suelo

const WELCOMES = [
  '¡Holi! Soy Pixel 🤖 Pregúntame lo que quieras sobre DevPlay, ¡aquí estoy para ayudarte!',
  '¡Aquí Pixel! 🤖 ¿Dudas? Pregunta sin miedo, para eso estoy 💛',
  '¡Hola! ¿Sabías que puedo explicarte cómo funciona casi todo DevPlay? Pregúntame 👀',
  '¡Qué alegría verte! 🤖 Cuéntame, ¿en qué te ayudo hoy?',
  'Soy Pixel, tu compa de DevPlay 🤖 Escríbeme y te echo una manita al instante ✨',
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return '¡Buenos días! ☕ ¿Lista la inspiración para crear hoy?'
  if (h >= 12 && h < 19) return '¡Buenas tardes! 🎮 Tómate un respiro, la creatividad también descansa'
  return '¿De noche? Yo también brillo más en la oscuridad 🌙'
}

// Altura del suelo según dispositivo: bajo en ambos (36px deja aire para la
// sombra y la barrita de gestos del celular sin que parezca que flota) 📱🖥️
const FLOOR_Y_MOBILE = 36 // suelo bajo también en móvil (pedido del dueño: flotaba muy alto)
const FLOOR_Y_DESKTOP = 12

export function PixelBuddy() {
  const { user, isAuthed, isGuest } = useCurrentUser()
  const currentView = useUIStore((s) => s.currentView)
  const openAuth = useUIStore((s) => s.openAuth)
  const setView = useUIStore((s) => s.setView)
  const openProfile = useUIStore((s) => s.openProfile)

  const [collapsed, setCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [tip, setTip] = useState('¡Hola! Soy Pixel, tu ayudante de DevPlay 🤖')
  const [pos, setPos] = useState({ x: 40, y: 24 })
  const [facing, setFacing] = useState(1)
  const [mounted, setMounted] = useState(false)
  const [vp, setVp] = useState({ w: 1280, h: 800 })
  const [mood, setMood] = useState<Mood>('idle')
  const [emote, setEmote] = useState<{ kind: Emote; key: number }>({ kind: 'none', key: 0 })
  const [particles, setParticles] = useState<{ id: number; emoji: string; dx: number }[]>([])
  // Altura VISIBLE real (visual viewport): cuando el teclado del celu abre,
  // el viewport visible se encoge y Pixel flota encima del teclado 📱⌨️
  const [vvH, setVvH] = useState(0)

  // Caminata 🚶, arrastre 🤏 y caiditas 🍂
  const [walking, setWalking] = useState(false)
  const [walkDur, setWalkDur] = useState(2)
  const [dragging, setDragging] = useState(false)
  const [falling, setFalling] = useState(false)
  const [fallDur, setFallDur] = useState(0.4)
  // Gestos al hablar 🗣️: boca y bracitos se mueven mientras Pixel responde
  const [talking, setTalking] = useState(false)
  const talkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nudgeTalk = useCallback((ms = 2400) => {
    setTalking(true)
    if (talkTimer.current) clearTimeout(talkTimer.current)
    talkTimer.current = setTimeout(() => setTalking(false), ms)
  }, [])
  const dragRef = useRef<{ startX: number; startY: number; offX: number; offY: number; moved: boolean } | null>(null)
  const wasDraggedRef = useRef(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const menuRef = useRef<HTMLDivElement>(null)
  const isMobile = vp.w < 1024
  // Pixel MÁS GRANDE 🤖✨ (pidió agrandarlo) y con suelo elevado en móvil
  const mascotSize = isMobile ? 64 : 68
  const floorY = isMobile ? FLOOR_Y_MOBILE : FLOOR_Y_DESKTOP
  const visibleH = vvH || vp.h
  const canChat = isAuthed // solo devs registrados; invitados/anónimos solo ven tips

  const clamp = useCallback((v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max)), [])

  // ===== Posición + límites: TODA la pantalla, de pared a pared 🌍 =====
  const limits = useCallback(
    (w?: number) => {
      const vw = w ?? vp.w
      return { minX: 12, maxX: Math.max(60, vw - mascotSize - 12) }
    },
    [vp.w, mascotSize]
  )

  // ===== Viewport (resize) =====
  useEffect(() => {
    setMounted(true)
    const w = window.innerWidth
    const h = window.innerHeight
    setVp({ w, h })
    // Posición guardada (solo X: Pixel siempre vive en el suelo)
    let initial = { x: 40, y: window.innerWidth < 1024 ? FLOOR_Y_MOBILE : FLOOR_Y_DESKTOP }
    try {
      const raw = localStorage.getItem('pixel-pos')
      if (raw) {
        const saved = JSON.parse(raw)
        const { minX, maxX } = limits(w)
        if (saved && typeof saved.x === 'number' && saved.x >= minX - 10 && saved.x <= maxX + 10) {
          initial = { x: saved.x, y: window.innerWidth < 1024 ? FLOOR_Y_MOBILE : FLOOR_Y_DESKTOP }
        }
      }
    } catch {}
    setPos(initial)
    try { setMuted(localStorage.getItem('pixel-tips-muted') === '1') } catch {}
    const onR = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onR)
    // Visual viewport: Pixel siempre encima del teclado del móvil 📱
    const vv = window.visualViewport
    const onVV = () => { if (vv) setVvH(vv.height) }
    if (vv) {
      onVV()
      vv.addEventListener('resize', onVV)
      vv.addEventListener('scroll', onVV)
    }
    return () => {
      window.removeEventListener('resize', onR)
      if (vv) {
        vv.removeEventListener('resize', onVV)
        vv.removeEventListener('scroll', onVV)
      }
    }
  }, [])

  // Mantener dentro de la pantalla al redimensionar + ajustar el suelo si
  // cambia el modo (ventana que cruza 1024px, rotar el celular, etc.)
  const lastFloorRef = useRef(floorY)
  useEffect(() => {
    if (!mounted) return
    setPos((p) => {
      const { maxX } = limits()
      const floorChanged = lastFloorRef.current !== floorY
      lastFloorRef.current = floorY
      const x = p.x > maxX ? maxX : p.x
      if (floorChanged && p.y !== floorY) return { x, y: floorY }
      if (x !== p.x) return { ...p, x }
      return p
    })
  }, [vp.w, mascotSize, mounted, limits, floorY])

  const savePos = useCallback((p: { x: number; y: number }) => {
    try { localStorage.setItem('pixel-pos', JSON.stringify(p)) } catch {}
  }, [])

  // ===== Caminar por todo el suelo, de pared a pared 🚶 =====
  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      // Cuando duerme 💤 NO camina (nada de sonambulismo jaja)
      if (chatOpen || registerOpen || dragging || falling || mood === 'sleepy') return
      const { minX, maxX } = limits()
      const span = maxX - minX
      // A veces paseo cortito, a veces atravieso TODA la pantalla
      const x = Math.random() < 0.45
        ? (Math.random() < 0.5 ? minX + Math.random() * span * 0.3 : maxX - Math.random() * span * 0.3)
        : minX + Math.random() * span
      setPos((prev) => {
        if (Math.abs(x - prev.x) < 50) return prev
        setFacing(x > prev.x ? 1 : -1)
        setWalkDur(Math.min(Math.max(Math.abs(x - prev.x) / WALK_SPEED, 0.8), 9))
        setWalking(true)
        return { x, y: floorY }
      })
    }, 15000)
    return () => clearInterval(interval)
  }, [mounted, chatOpen, registerOpen, dragging, falling, limits, mood])

  // ===== Personalidad: emotes (saltar, bailar, girar, guiñar, chispas) =====
  const doEmote = useCallback((kind: Emote, m: Mood = 'idle') => {
    setEmote((e) => ({ kind, key: e.key + 1 }))
    if (m !== 'idle') {
      setMood(m)
      setTimeout(() => setMood('idle'), 2000)
    }
  }, [])

  const spawnParticles = useCallback((n = 1) => {
    const batch = Array.from({ length: n }, (_, i) => ({
      id: Date.now() + i + Math.random(),
      emoji: PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)],
      dx: Math.random() * 48 - 16,
    }))
    setParticles((p) => [...p.slice(-6), ...batch])
    setTimeout(() => setParticles((p) => p.filter((x) => !batch.some((b) => b.id === x.id))), 1600)
  }, [])

  // Pixel es AUTÓNOMO 🤖: se entretiene solo (saltitos, bailecitos, giros, guiños)
  useEffect(() => {
    // Dormido 💤 = quieto: ni saltos ni bailes ni giros
    if (!mounted || collapsed || chatOpen || registerOpen || walking || dragging || falling || mood === 'dizzy' || mood === 'sleepy') return
    const t = setInterval(() => {
      const r = Math.random()
      if (r < 0.2) doEmote('jump', 'happy')
      else if (r < 0.36) doEmote('dance')
      else if (r < 0.5) doEmote('spin', 'excited')
      else if (r < 0.62) { doEmote('jump', 'excited'); spawnParticles(2) }
      else if (r < 0.76) doEmote('none', 'wink')
      else if (r < 0.88) doEmote('none', 'happy')
      else { doEmote('none', 'excited'); spawnParticles(1) }
    }, 8500 + Math.random() * 3500)
    return () => clearInterval(t)
  }, [mounted, collapsed, chatOpen, registerOpen, walking, dragging, falling, mood, doEmote, spawnParticles])

  // ===== Dormilón: si nadie lo pela en 100s, se duerme 💤 =====
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetIdle = useCallback(() => {
    setMood((m) => (m === 'sleepy' ? 'idle' : m))
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      setMood('sleepy')
    }, 100000)
  }, [])
  useEffect(() => {
    if (!mounted || collapsed) return
    resetIdle()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [mounted, collapsed, resetIdle])

  // ===== Burbujas de eventos (sin chips de recomendación) =====
  // Pixel ya NO suelta tips en bucle: solo habla cuando tiene algo que decir de verdad 💬
  const showBubble = useCallback((msg: string, ms = 4200) => {
    setTip(msg)
    setBubbleVisible(!muted)
    if (!muted) {
      setTimeout(() => setBubbleVisible(false), ms)
    }
  }, [muted])

  // Saludo de bienvenida una sola vez por sesión
  useEffect(() => {
    if (!mounted) return
    let greeted = false
    try { greeted = sessionStorage.getItem('pixel-greeted') === '1' } catch {}
    if (!greeted) {
      try { sessionStorage.setItem('pixel-greeted', '1') } catch {}
      if (!muted) {
        setTip(timeGreeting())
        setBubbleVisible(true)
        const t = setTimeout(() => setBubbleVisible(false), 6500)
        return () => clearTimeout(t)
      }
    }
  }, [mounted, muted])

  // ===== Ojos autónomos 👀: Pixel mira para donde ÉL quiere, no donde está el cursor =====
  const pupilX = useSpring(useMotionValue(0), { stiffness: 300, damping: 22 })
  const pupilY = useSpring(useMotionValue(0), { stiffness: 300, damping: 22 })

  useEffect(() => {
    if (!mounted) return
    const look = () => {
      if (dragging || falling) {
        pupilX.set(0)
        pupilY.set(0)
        return
      }
      if (walking) {
        // Mira hacia donde camina
        pupilX.set(facing * 2.2)
        pupilY.set(-0.4)
        return
      }
      const r = Math.random()
      const side = Math.random() < 0.5 ? 1 : -1
      if (r < 0.34) { pupilX.set(0); pupilY.set(0) }
      else if (r < 0.56) { pupilX.set(2.3 * side); pupilY.set(0) }
      else if (r < 0.72) { pupilX.set(1.7 * side); pupilY.set(-1.9) }
      else if (r < 0.86) { pupilX.set(1.9 * side); pupilY.set(1.7) }
      else { pupilX.set(0); pupilY.set(0) }
    }
    look()
    const t = setInterval(look, 2700)
    return () => clearInterval(t)
  }, [mounted, walking, facing, dragging, falling, pupilX, pupilY])

  // ===== Click y arrastre 🤏 =====
  function actualPos(): { x: number; y: number } {
    const el = btnRef.current
    if (!el) return pos
    const r = el.getBoundingClientRect()
    return { x: r.left, y: window.innerHeight - r.bottom }
  }

  // ===== Caída con gravedad 🍂: al soltar, cae hasta el suelo con carita de susto =====
  function startFall() {
    const p = actualPos()
    const { minX, maxX } = limits()
    const x = clamp(p.x, minX - 2, maxX + 2)
    const h = Math.max(0, p.y - floorY)
    if (h < 4) {
      // Ya estaba en el suelo: solo un plop de aterrizaje
      setPos((pp) => { savePos({ x: pp.x, y: floorY }); return { x: pp.x, y: floorY } })
      doEmote('land')
      spawnParticles(2)
      setMood('dizzy')
      setTimeout(() => setMood('happy'), 1000)
      setTimeout(() => setMood('idle'), 2400)
      return
    }
    // Gravedad suavecita (pedido del dueño: caía muy rápido) 🪂
    // √(h/1100) ≈ 1.5x más lento que antes; tope 1.25s para caídas largas
    setFallDur(Math.min(Math.max(Math.sqrt(h / 1100), 0.3), 1.25))
    setMood('shocked')
    setFalling(true)
    setPos({ x, y: floorY })
  }

  function landIt() {
    setFalling(false)
    setPos((p) => { savePos({ x: p.x, y: floorY }); return p })
    doEmote('land')
    spawnParticles(2)
    setMood('dizzy')
    setTimeout(() => setMood('happy'), 1000)
    setTimeout(() => setMood('idle'), 2400)
  }

  function handleBuddyClick() {
    resetIdle()
    setBubbleVisible(false)
    if (mood === 'sleepy') {
      setMood('excited')
      setTimeout(() => setMood('idle'), 1500)
      spawnParticles(2)
      showBubble('¡Aaah! Me quedé dormido 😴 ¿En qué andamos?')
      return
    }
    doEmote('jump', 'happy')
    spawnParticles(1)
    if (canChat) {
      setRegisterOpen(false)
      setChatOpen((v) => !v)
    } else {
      setChatOpen(false)
      setRegisterOpen((v) => !v)
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (collapsed) return
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId) } catch {}
    const p = actualPos()
    // Detener caminata donde esté y fijar posición real
    setWalking(false)
    setPos(p)
    dragRef.current = { startX: e.clientX, startY: e.clientY, offX: e.clientX - p.x, offY: (window.innerHeight - e.clientY) - p.y, moved: false }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = (window.innerHeight - e.clientY) - (window.innerHeight - d.startY)
    if (!d.moved && Math.hypot(dx, dy) > 7) {
      d.moved = true
      wasDraggedRef.current = true
      setDragging(true)
      setBubbleVisible(false)
      setChatOpen(false)
      setRegisterOpen(false)
      setMood('excited')
    }
    if (!d.moved) return
    const { minX, maxX } = limits()
    setFacing(dx >= 0 ? 1 : -1)
    setPos({
      x: clamp(e.clientX - d.offX, minX - 6, maxX + 10),
      y: clamp((window.innerHeight - e.clientY) - d.offY, floorY, Math.max(floorY, visibleH - mascotSize - 14)),
    })
  }

  function onPointerUp() {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.moved) {
      wasDraggedRef.current = false
      setDragging(false)
      startFall()
    } else {
      handleBuddyClick()
    }
  }

  function onPointerCancel() {
    const d = dragRef.current
    dragRef.current = null
    if (d?.moved) {
      wasDraggedRef.current = false
      setDragging(false)
      startFall()
    }
  }

  // Red de seguridad: si el pointerup ocurre fuera (captura perdida), terminar el arrastre con caidita
  useEffect(() => {
    if (!dragging) return
    const end = () => {
      if (dragRef.current?.moved) {
        wasDraggedRef.current = false
        setDragging(false)
        startFall()
      }
      dragRef.current = null
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('blur', end)
    }
  }, [dragging, savePos])

  // ===== Chat con IA (solo registrados) =====
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [welcome, setWelcome] = useState(WELCOMES[0])
  const listRef = useRef<HTMLDivElement>(null)
  const storageKey = user && !user.isGuest ? `pixel-chat-${user.id}` : null
  const loadedRef = useRef(false)

  // ===== Poderes por chat ✨: Pixel te lleva a los sitios y hace gestos si se lo pides =====
  const playGesture = useCallback((kind: string) => {
    switch (kind) {
      case 'saltar': doEmote('jump', 'happy'); break
      case 'bailar': doEmote('dance'); break
      case 'girar': doEmote('spin', 'excited'); break
      case 'guinyar': doEmote('none', 'wink'); break
      case 'celebrar': doEmote('jump', 'excited'); spawnParticles(4); break
      case 'susto':
        setMood('shocked')
        setTimeout(() => setMood('idle'), 1600)
        break
      case 'feliz': doEmote('none', 'happy'); spawnParticles(1); break
    }
  }, [doEmote, spawnParticles])

  const goTo = useCallback((view: string): boolean => {
    if (view === 'profile') {
      if (user && !user.isGuest) {
        openProfile(user.id)
        return true
      }
      return false
    }
    if (VALID_VIEWS.has(view)) {
      setView(view as ViewId)
      return true
    }
    return false
  }, [user, openProfile, setView])

  // Bienvenida nueva cada vez que se abre el chat vacío
  useEffect(() => {
    if (chatOpen && messages.length === 0) {
      setWelcome(pickRandom(WELCOMES))
    }
  }, [chatOpen, messages.length])

  // Cargar historial guardado (por usuario) y guardarlo en cada cambio
  useEffect(() => {
    loadedRef.current = false
    if (!storageKey) {
      setMessages([])
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      setMessages(raw ? JSON.parse(raw) : [])
    } catch {
      setMessages([])
    }
    loadedRef.current = true
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || !loadedRef.current) return
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-60))) } catch {}
  }, [messages, storageKey])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, chatOpen])

  async function ask(text: string) {
    const content = text.trim()
    if (!content || thinking) return
    const next: ChatMsg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setThinking(true)
    nudgeTalk(15000)
    try {
      // M4 (buddy) todavía no está en la API de FastAPI.
      const data = await api.askBuddy(next)
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || data.error || 'Ay, se me nublaban los circuitos 🤖' }])
      nudgeTalk(2600)
      // Ejecuta los poderes que pidió el usuario (gesto, paseo a otra vista)
      const actions: BuddyAction[] = Array.isArray(data.actions) ? data.actions : []
      if (actions.length > 0) {
        setTimeout(() => {
          for (const a of actions) {
            if (a.type === 'gesture') {
              playGesture(a.value)
            } else if (a.type === 'go' && goTo(a.value)) {
              doEmote('jump', 'excited')
              spawnParticles(3)
            }
          }
        }, 1100)
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'No conecté con mi cabecita 🤖 revisa tu conexión e inténtalo otra vez' }])
      nudgeTalk(1500)
    } finally {
      setThinking(false)
    }
  }

  // ===== Menú ⋮ =====
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [menuOpen])

  function newChat() {
    setMessages([])
    setInput('')
    setWelcome(pickRandom(WELCOMES))
    setMenuOpen(false)
  }
  function deleteChat() {
    setMessages([])
    if (storageKey) { try { localStorage.removeItem(storageKey) } catch {} }
    setMenuOpen(false)
    setChatOpen(false)
    showBubble('¡Puf! Todo limpiecito y como nuevo ✨')
  }
  function copyChat() {
    if (messages.length === 0) return
    const txt = messages.map((m) => `${m.role === 'user' ? 'Tú' : 'Pixel'}: ${m.content}`).join('\n')
    navigator.clipboard?.writeText(txt).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  function toggleMute() {
    setMuted((v) => {
      const nv = !v
      try { localStorage.setItem('pixel-tips-muted', nv ? '1' : '0') } catch {}
      return nv
    })
    setMenuOpen(false)
  }
  function minimizePixel() {
    setCollapsed(true)
    setChatOpen(false)
    setRegisterOpen(false)
    setMenuOpen(false)
  }

  if (!mounted) return null

  // ===== Geometría responsive (todo dentro de la pantalla) =====
  const bubbleW = isMobile ? 196 : 216
  const bubbleLeft = clamp(pos.x + mascotSize / 2 - bubbleW / 2, 8, vp.w - bubbleW - 8)
  const arrowLeft = clamp(pos.x + mascotSize / 2 - bubbleLeft - 7, 14, bubbleW - 28)
  const panelW = Math.min(300, vp.w - 16)
  const panelLeft = isMobile ? 8 : clamp(pos.x + mascotSize / 2 - panelW / 2, 10, vp.w - panelW - 10)
  // El panel flota SIEMPRE por encima de Pixel (en móvil también, bien arribita)
  const panelBottom = pos.y + mascotSize + (isMobile ? 8 : 10)

  if (collapsed) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => { setCollapsed(false); resetIdle() }}
        className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full glass-strong shadow-lg flex items-center justify-center"
        data-tour="pixel-buddy"
        title="Abrir a Pixel"
      >
        <MiniPixelFace />
      </motion.button>
    )
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40"
      style={vvH ? { height: vvH } : undefined}
      data-tour="pixel-buddy"
    >
      {/* ===== Partículas emoji ===== */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], y: -46, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="absolute text-sm select-none"
            style={{ left: pos.x + mascotSize / 2 - 8 + p.dx, bottom: pos.y + mascotSize + 4 }}
          >
            {p.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      {/* ===== Burbuja de mensaje ===== */}
      <AnimatePresence>
        {bubbleVisible && !chatOpen && !registerOpen && !walking && !dragging && !falling && (
          <motion.div
            key={tip}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            className="pointer-events-auto absolute"
            style={{ left: bubbleLeft, bottom: pos.y + mascotSize + 8, width: bubbleW }}
          >
            <div className="glass-strong rounded-lg rounded-bl-none border border-border/60 px-3 py-2 shadow-lg relative">
              <button
                onClick={() => setBubbleVisible(false)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-secondary text-muted-foreground flex items-center justify-center hover:text-foreground transition"
                aria-label="Cerrar mensaje"
              >
                <X className="h-2.5 w-2.5" />
              </button>
              <p className="text-[11px] leading-snug text-foreground/90">{tip}</p>
            </div>
            <div
              className="h-0 w-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-border/60"
              style={{ marginLeft: arrowLeft }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Panel de registro (invitados) ===== */}
      <AnimatePresence>
        {registerOpen && (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="pointer-events-auto absolute z-10 glass-strong rounded-lg border border-border/60 shadow-xl overflow-hidden"
            style={{ left: panelLeft, width: isMobile ? undefined : panelW, right: isMobile ? 8 : undefined, bottom: panelBottom }}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-gradient-to-r from-primary/15 via-accent/10 to-transparent">
              <PixelIcon size={26} mood="wink" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-none">Pixel</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Zona exclusiva de devs registrados</p>
              </div>
              <button
                onClick={() => setRegisterOpen(false)}
                className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/60 transition"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-4 py-4 text-center">
              <PixelIcon size={46} mood="happy" className="mx-auto mb-2" />
              <p className="text-xs font-bold mb-1">¡Hola! Soy Pixel 🤖</p>
              <p className="text-[11px] text-muted-foreground leading-snug mb-3">
                Solo puedo platicar con devs registrados... ¡es mi regla de oro!
                Pero mis tips te los regalo igual 😉
              </p>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => { setRegisterOpen(false); openAuth('register') }}
                  className="btn-gradient-primary rounded-full py-2 text-xs font-bold text-white transition hover:opacity-90"
                >
                  Crear cuenta gratis
                </button>
                <button
                  onClick={() => { setRegisterOpen(false); openAuth('login') }}
                  className="rounded-full border border-border py-2 text-xs font-bold hover:bg-secondary/60 transition"
                >
                  Ya tengo cuenta
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Panel de preguntas (IA) ===== */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="pointer-events-auto absolute z-10 glass-strong rounded-lg border border-border/60 shadow-xl overflow-hidden flex flex-col"
            style={{
              left: panelLeft,
              width: isMobile ? undefined : panelW,
              right: isMobile ? 8 : undefined,
              bottom: panelBottom,
              maxHeight: isMobile ? '58vh' : undefined,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-gradient-to-r from-primary/15 via-accent/10 to-transparent">
              <PixelIcon size={28} mood={mood} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-none">Pixel</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-olive-400 live-pulse" />
                  {thinking ? 'Pensandito...' : 'Asistente con IA · pregúntame'}
                </p>
              </div>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/60 transition"
                  aria-label="Opciones del chat"
                  title="Opciones del chat"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      key="menu"
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-7 z-20 w-48 glass-strong rounded-md border border-border/60 shadow-lg py-1"
                    >
                      <MenuItem icon={MessageSquarePlus} label="Nuevo chat" onClick={newChat} />
                      <MenuItem icon={Trash2} label="Eliminar conversación" onClick={deleteChat} danger />
                      <MenuItem
                        icon={copied ? Check : Copy}
                        label={copied ? '¡Copiado!' : 'Copiar conversación'}
                        onClick={copyChat}
                        disabled={messages.length === 0}
                      />
                      <MenuItem
                        icon={muted ? VolumeX : Volume2}
                        label={muted ? 'Activar burbujas' : 'Silenciar burbujas'}
                        onClick={toggleMute}
                      />
                      <MenuItem icon={Minimize2} label="Minimizar Pixel" onClick={minimizePixel} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/60 transition"
                aria-label="Cerrar chat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Mensajes */}
            <div
              ref={listRef}
              className={cn('overflow-y-auto custom-scroll px-3 py-2.5 space-y-2', isMobile ? 'h-44' : 'h-64')}
            >
              {messages.length === 0 && (
                <div className="text-center py-3">
                  <PixelIcon size={40} mood="happy" className="mx-auto mb-1.5" />
                  <p className="text-[11px] text-muted-foreground leading-snug px-2">{welcome}</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug whitespace-pre-line',
                      m.role === 'user'
                        ? 'btn-gradient-primary text-white rounded-br-sm'
                        : 'glass border border-border/50 rounded-bl-sm'
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="glass border border-border/50 rounded-lg rounded-bl-sm px-2.5 py-2 flex items-center gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); ask(input) }}
              className="flex items-center gap-1.5 border-t border-border/50 p-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregúntale a Pixel..."
                maxLength={300}
                className="flex-1 min-w-0 rounded-full border border-input bg-transparent px-3 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={thinking || !input.trim()}
                className="btn-gradient-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50 transition"
                aria-label="Enviar"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== El muñequito (caminante y arrastrable) ===== */}
      <motion.button
        ref={btnRef}
        onClick={() => { if (wasDraggedRef.current) { wasDraggedRef.current = false; return } }}
        onDoubleClick={() => minimizePixel()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        animate={{ x: pos.x, y: -pos.y }}
        transition={
          dragging ? { duration: 0 }
            : falling ? { duration: fallDur, ease: 'easeIn' }
            : walking ? { duration: walkDur, ease: 'linear' }
            : { type: 'spring', stiffness: 60, damping: 15 }
        }
        onAnimationComplete={() => {
          if (falling) {
            landIt()
            return
          }
          setWalking((w) => {
            if (w) {
              savePos({ x: pos.x, y: floorY })
              // Llegó de su caminata: a veces celebra con un saltito 🤖
              if (Math.random() < 0.35) setTimeout(() => doEmote('jump', 'excited'), 200)
            }
            return false
          })
        }}
        className={cn(
          'pointer-events-auto absolute left-0 bottom-0 z-0 cursor-grab select-none touch-none',
          dragging && 'cursor-grabbing z-30'
        )}
        title="Pixel · tócame para hablar, arrástrame y suéltame ¡hago caiditas! (doble clic minimiza)"
        aria-label="Pixel, asistente de IA"
      >
        {/* Flotación suave (solo cuando está quieto y despierto) */}
        <motion.div
          animate={walking || dragging || falling || mood === 'sleepy' ? { y: 0 } : { y: [0, -5, 0] }}
          transition={{ duration: 2.4, repeat: walking || dragging || falling || mood === 'sleepy' ? 0 : Infinity, ease: 'easeInOut' }}
          whileHover={{ scale: walking || dragging || falling ? 1 : 1.1 }}
        >
          {/* Emotes de un disparo (salto / baile / aterrizaje) */}
          <motion.div
            key={emote.key}
            style={{ transformOrigin: '50% 100%' }}
            animate={
              dragging ? { rotate: [-4, 4, -4] }
                : falling ? { rotate: [-6, 5, -6] }
                  : emote.kind === 'land'
                    ? { scaleY: [1, 0.6, 1.15, 0.92, 1], scaleX: [1, 1.3, 0.9, 1.05, 1], y: [0, 5, -3, 0, 0] }
                    : emote.kind === 'jump'
                      ? { y: [0, -20, 0, -8, 0], rotate: 0 }
                      : emote.kind === 'dance'
                        ? { rotate: [0, -8, 8, -6, 6, 0], y: [0, -3, 0, -3, 0, 0] }
                        : emote.kind === 'spin'
                          ? { rotate: [0, 360], y: [0, -6, 0] }
                          : { y: 0, rotate: 0 }
            }
            transition={
              dragging ? { duration: 0.45, repeat: Infinity, ease: 'easeInOut' }
                : falling ? { duration: 0.35, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: emote.kind === 'land' ? 0.55 : emote.kind === 'jump' ? 0.9 : emote.kind === 'spin' ? 1.1 : 1.4, ease: 'easeOut' }
            }
          >
            <motion.div animate={{ scaleX: facing }} transition={{ duration: 0.25 }}>
              <PixelIcon size={mascotSize} pupilX={pupilX} pupilY={pupilY} mood={mood} walking={walking} carried={dragging} falling={falling} talking={talking} />
            </motion.div>
            {/* Badge IA */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-bronze-500 shadow">
              <Sparkles className="h-2.5 w-2.5 text-white" />
            </span>
          </motion.div>
        </motion.div>
      </motion.button>
    </div>
  )
}

// ===== Ítem del menú ⋮ =====
function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: any
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-left transition',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : danger
            ? 'text-wine-600 hover:bg-wine-500/10'
            : 'text-foreground/85 hover:bg-secondary/70'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  )
}

// ===== Robot SVG con humores, caminata real, caída y gestos al hablar =====
export function PixelIcon({
  size = 48,
  pupilX,
  pupilY,
  mood = 'idle',
  walking = false,
  carried = false,
  falling = false,
  talking = false,
  className,
}: {
  size?: number
  pupilX?: any
  pupilY?: any
  mood?: Mood
  walking?: boolean
  carried?: boolean
  falling?: boolean
  talking?: boolean
  className?: string
}) {
  const hasTracking = !!pupilX && !!pupilY

  const eyes = () => {
    if (mood === 'dizzy') {
      // Ojos en X de tanto girar 🍂
      return (
        <g stroke="#4A2E21" strokeWidth="1.9" strokeLinecap="round" fill="none">
          <path d="M23 26.5 L28 31.5 M28 26.5 L23 31.5" />
          <path d="M36 26.5 L41 31.5 M41 26.5 L36 31.5" />
        </g>
      )
    }
    if (mood === 'shocked' || falling) {
      // ¡¿QUÉ?! Ojos de plato
      return (
        <g>
          <circle cx="25.5" cy="29" r="4.8" fill="#FFF6E8" stroke="#4A2E21" strokeWidth="1.6" />
          <circle cx="38.5" cy="29" r="4.8" fill="#FFF6E8" stroke="#4A2E21" strokeWidth="1.6" />
          <circle cx="25.5" cy="29.6" r="1.8" fill="#4A2E21" />
          <circle cx="38.5" cy="29.6" r="1.8" fill="#4A2E21" />
        </g>
      )
    }
    if (mood === 'sleepy') {
      return (
        <g stroke="#4A2E21" strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M22.5 29.5 Q25.5 32.5 28.5 29.5" />
          <path d="M35.5 29.5 Q38.5 32.5 41.5 29.5" />
        </g>
      )
    }
    if (mood === 'happy') {
      return (
        <g stroke="#4A2E21" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M22.5 30 Q25.5 26 28.5 30" />
          <path d="M35.5 30 Q38.5 26 41.5 30" />
        </g>
      )
    }
    if (mood === 'wink') {
      return (
        <g>
          <circle cx="25.5" cy="29" r="3.4" fill="#4A2E21" />
          <circle cx="26.6" cy="28" r="1.1" fill="#FFF6E8" />
          <path d="M35.5 29 Q38.5 32 41.5 29" stroke="#4A2E21" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>
      )
    }
    return (
      <motion.g
        style={hasTracking ? { x: pupilX, y: pupilY } : undefined}
        animate={mood === 'idle' && !walking ? { scaleY: [1, 1, 0.12, 1] } : { scaleY: 1 }}
        transition={mood === 'idle' && !walking ? { duration: 0.5, times: [0, 0.72, 0.86, 1], repeat: Infinity, repeatDelay: 3.4 } : undefined}
      >
        <circle cx="25.5" cy="29" r={mood === 'excited' ? 3.9 : 3.4} fill="#4A2E21" />
        <circle cx="38.5" cy="29" r={mood === 'excited' ? 3.9 : 3.4} fill="#4A2E21" />
        <circle cx="26.6" cy="28" r="1.1" fill="#FFF6E8" />
        <circle cx="39.6" cy="28" r="1.1" fill="#FFF6E8" />
      </motion.g>
    )
  }

  const mouth = () => {
    if (talking) {
      // Boquita que se mueve mientras habla 🗣️
      return (
        <ellipse cx="32" cy="36.5" rx="3" ry="2.2" fill="#4A2E21">
          <animate attributeName="ry" values="1.1;2.8;1.1" dur="0.32s" repeatCount="indefinite" />
          <animate attributeName="rx" values="2.3;3.5;2.3" dur="0.32s" repeatCount="indefinite" />
        </ellipse>
      )
    }
    if (mood === 'dizzy') {
      return <path d="M27.5 36.5 Q29.75 34.6 32 36.5 Q34.25 38.4 36.5 36.5" stroke="#4A2E21" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    }
    if (mood === 'shocked' || falling) {
      return <ellipse cx="32" cy="37.5" rx="2.7" ry="3.1" fill="#4A2E21" />
    }
    if (mood === 'excited') {
      return <ellipse cx="32" cy="37" rx="2.6" ry="3" fill="#4A2E21" />
    }
    if (mood === 'sleepy') {
      return <path d="M30 37 Q32 38.4 34 37" stroke="#4A2E21" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    }
    if (mood === 'happy') {
      return <path d="M26 34.5 Q32 41 38 34.5" stroke="#4A2E21" strokeWidth="1.9" fill="none" strokeLinecap="round" />
    }
    return <path d="M27 35.5 Q32 39.5 37 35.5" stroke="#4A2E21" strokeWidth="1.7" fill="none" strokeLinecap="round" />
  }

  // Pasitos 🚶 — zancada alternada: un pie siempre apoyado, sin brincos raros
  const cycleDur = 0.8
  const stepTimes = [0, 0.2, 0.5, 0.7, 1]
  const foot = (side: 1 | -1) => {
    if (falling) {
      // Piernitas juntitas de susto
      return <rect x={side === 1 ? 23 : 31} y="52" width="10" height="6" rx="3" fill="#8A4526" />
    }
    if (carried) {
      // Colgaditos, bien relajados
      return <rect x={side === 1 ? 22 : 32} y="51.5" width="10" height="6" rx="3" fill="#8A4526" />
    }
    if (!walking) {
      return <rect x={side === 1 ? 20 : 34} y="50" width="10" height="6" rx="3" fill="#8A4526" />
    }
    return side === 1 ? (
      <motion.rect
        width="10"
        height="6"
        rx="3"
        fill="#8A4526"
        animate={{ x: [20, 26, 26, 16, 20], y: [50, 46.5, 50, 50, 50] }}
        transition={{ duration: cycleDur, times: stepTimes, repeat: Infinity, ease: 'easeInOut' }}
      />
    ) : (
      <motion.rect
        width="10"
        height="6"
        rx="3"
        fill="#8A4526"
        animate={{ x: [34, 30, 30, 38, 34], y: [50, 50, 46.5, 50, 50] }}
        transition={{ duration: cycleDur, times: stepTimes, repeat: Infinity, ease: 'easeInOut' }}
      />
    )
  }

  // Bracitos: se mecen al caminar 🚶, arriba en la caída 😱, colgando en el aire y saludan al hablar 👋
  const arm = (side: 1 | -1) => {
    const cx = side === 1 ? 9 : 55
    if (falling) {
      return (
        <motion.circle
          cx={side === 1 ? 7 : 57}
          r="4"
          fill="#A9552F"
          animate={{ cy: [25, 21.5, 25] }}
          transition={{ duration: 0.3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )
    }
    if (carried) {
      return <circle cx={side === 1 ? 8 : 56} cy="36.5" r="4" fill="#A9552F" />
    }
    if (talking && side === -1) {
      // ¡Holaaa! Manito que saluda
      return (
        <motion.circle
          r="4"
          fill="#A9552F"
          animate={{ cy: [34, 26.5, 26.5, 34], cx: [55, 57, 52, 55] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )
    }
    if (talking && side === 1) {
      return <circle cx={cx} cy="35.5" r="4" fill="#A9552F" />
    }
    if (!walking) return <circle cx={cx} cy="34" r="4" fill="#A9552F" />
    return (
      <motion.circle
        cy="34"
        r="4"
        fill="#A9552F"
        animate={{ cy: side === 1 ? [34, 38, 34, 30, 34] : [34, 30, 34, 38, 34] }}
        transition={{ duration: cycleDur, times: stepTimes, repeat: Infinity, ease: 'easeInOut' }}
      />
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
      {/* Sombra: se achica cuando vuela 🍂 */}
      <ellipse
        cx="32"
        cy="60"
        rx={carried || falling ? 7 : walking ? 10 : 14}
        ry="2.6"
        fill="rgba(74,46,33,0.25)"
        opacity={carried || falling ? 0.45 : 1}
      />
      {/* Antena */}
      <line x1="32" y1="8" x2="32" y2="14" stroke="#A9552F" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="6.5" r="3.2" fill="#E8A04C">
        <animate attributeName="r" values="3.2;3.8;3.2" dur="1.6s" repeatCount="indefinite" />
      </circle>
      {/* Cuerpo (con rebote al caminar) */}
      <motion.g
        animate={walking ? { y: [0, -1.6, 0] } : { y: 0 }}
        transition={walking ? { duration: 0.4, repeat: Infinity, ease: 'linear' } : undefined}
      >
        <rect x="12" y="14" width="40" height="36" rx="13" fill="#C66E41" />
        <rect x="12" y="14" width="40" height="36" rx="13" fill="url(#pixelBody)" />
        <defs>
          <linearGradient id="pixelBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,235,210,0.28)" />
            <stop offset="1" stopColor="rgba(74,46,33,0.18)" />
          </linearGradient>
        </defs>
        {/* Brazos */}
        {arm(1)}
        {arm(-1)}
        {/* Pantalla de cara */}
        <rect x="17" y="19.5" width="30" height="21" rx="9" fill="#F6E8D4" />
        {/* Ojos según humor */}
        {eyes()}
        {/* Boca según humor */}
        {mouth()}
        {/* Mejillas */}
        <circle cx="21.5" cy="33.5" r="1.8" fill="#E8A04C" opacity="0.75" />
        <circle cx="42.5" cy="33.5" r="1.8" fill="#E8A04C" opacity="0.75" />
        {/* Panza */}
        <rect x="24" y="43" width="16" height="4" rx="2" fill="#8A4526" opacity="0.55" />
      </motion.g>
      {/* Pies */}
      {foot(1)}
      {foot(-1)}
      {/* Zzz cuando duerme */}
      {mood === 'sleepy' && (
        <g fill="#4A2E21" fontWeight="bold" fontFamily="monospace">
          <text x="50" y="14" fontSize="8" opacity="0.85">
            Z<animate attributeName="opacity" values="0;0.85;0" dur="2.2s" repeatCount="indefinite" />
          </text>
          <text x="55" y="8" fontSize="6" opacity="0.6">
            Z<animate attributeName="opacity" values="0;0.6;0" dur="2.2s" begin="0.7s" repeatCount="indefinite" />
          </text>
        </g>
      )}
    </svg>
  )
}

function MiniPixelFace() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64">
      <rect x="12" y="14" width="40" height="36" rx="13" fill="#C66E41" />
      <rect x="17" y="19.5" width="30" height="21" rx="9" fill="#F6E8D4" />
      <circle cx="25.5" cy="29" r="3.4" fill="#4A2E21" />
      <circle cx="38.5" cy="29" r="3.4" fill="#4A2E21" />
      <path d="M27 35.5 Q32 39.5 37 35.5" stroke="#4A2E21" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <circle cx="21.5" cy="33.5" r="1.8" fill="#E8A04C" opacity="0.75" />
      <circle cx="42.5" cy="33.5" r="1.8" fill="#E8A04C" opacity="0.75" />
    </svg>
  )
}







