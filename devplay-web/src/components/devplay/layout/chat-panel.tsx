'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MessageSquare, Send, X, Copy, Check, Flag, ScrollText, Globe, MoreVertical, Eraser, Trash2, Link2, Maximize2, Mail } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useT } from '@/lib/i18n'
import { useWorldChat, useSocket, type ChatMessage } from '@/hooks/use-socket'
import { DMView } from '@/components/devplay/layout/dm-panel'
import { UserAvatar, TimeAgo } from '@/components/devplay/shared/shared'
import { filterProfanity } from '@/lib/profanity'
import { AdSlot } from '@/components/devplay/shared/ad-slot'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const QUICK_EMOJIS = ['🎮', '🔥', '👀', '❤️', '🚀', '😎']

interface ChatPanelProps {
  variant?: 'sidebar' | 'fullview'
}

export function ChatPanel({ variant = 'sidebar' }: ChatPanelProps) {
  const { t } = useT()
  const { user, isGuest } = useCurrentUser()
  const { chatOpen, toggleChat, openAuth, setView, chatTab, setChatTab, dmUnread, dmPeerId } = useUIStore()
  const { messages, sendMessage, deleteMessage, clearMessages, deleteMyMessages, isConnected } = useWorldChat(user?.id, user?.username)
  const { socket } = useSocket()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // ===== 🔔 DM en vivo: badge de no leídos + aviso amable =====
  useEffect(() => {
    if (!socket) return
    const onDMNew = (m: any) => {
      if (m?.recipientId !== user?.id) return
      const s = useUIStore.getState()
      if (s.chatTab === 'dm' && s.dmPeerId === m.senderId) return // ya lo está leyendo
      s.setDMUnread(s.dmUnread + 1)
      toast(`${m.sender?.username ?? 'Un dev'} te escribió 💬`, {
        description: String(m.content ?? '').slice(0, 60),
      })
    }
    socket.on('dm:new', onDMNew)
    return () => { socket.off('dm:new', onDMNew) }
  }, [socket, user?.id])

  // ===== Antiflood: 5 segundos entre mensajes =====
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [cooldown])

  // Privacidad de la sala 🤫: ya NO se muestra quién está en el chat mundial

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    if (!user || isGuest) return
    if (cooldown > 0) {
      toast.info(`Tranqui, espera ${cooldown}s para enviar otro mensaje`)
      return
    }
    sendMessage(input)
    setInput('')
    setCooldown(5)
  }

  const handleQuickEmoji = (emoji: string) => {
    if (!user || isGuest || cooldown > 0) return
    sendMessage(emoji)
    setCooldown(5)
  }

  const canChat = user && !isGuest

  const isFull = variant === 'fullview'

  // ===== Acciones del menú de opciones =====
  const handleDeleteMessage = async (id: string) => {
    const ok = await deleteMessage(id)
    if (ok) toast.success('Mensaje eliminado')
    else toast.error('No se pudo eliminar el mensaje')
  }

  const handleClearLocal = () => {
    clearMessages()
    toast.success('Conversación limpiada en este dispositivo')
  }

  const handleDeleteAllMine = async () => {
    const n = await deleteMyMessages()
    if (n > 0) toast.success(n === 1 ? '1 mensaje eliminado' : `${n} mensajes eliminados`)
    else toast.info('No tenías mensajes en la sala')
  }

  /* ===== Zona de mensajes (compartida) ===== */
  const messagesArea = (
    <div
      ref={scrollRef}
      className="custom-scroll paper-dots flex-1 overflow-y-auto p-3 space-y-2.5"
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground px-6">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-sm frame-double bg-secondary">
            <MessageSquare className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-display font-bold text-foreground">La plaza está tranquila…</p>
          <p className="text-xs mt-1 italic">rompe el hielo con un ¡hola, devs!</p>
          <div className="rule-ornate w-24 mt-4 opacity-60">
            <span className="text-[8px]">◆</span>
          </div>
        </div>
      ) : (
        messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} isMine={msg.userId === user?.id} onDelete={handleDeleteMessage} />
        ))
      )}
    </div>
  )

  /* ===== Fila de emojis rápidos ===== */
  const emojiRow = canChat ? (
    <div className="flex items-center gap-1 border-t border-border/40 px-3 py-1.5 bg-secondary/30">
      <span className="label-caps !text-[8px] mr-1 opacity-70 shrink-0">Rápido</span>
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleQuickEmoji(emoji)}
          disabled={cooldown > 0}
          className="flex h-6 w-6 items-center justify-center rounded-sm text-sm transition hover:bg-accent hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
          title={cooldown > 0 ? `Espera ${cooldown}s` : `Enviar ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      {cooldown > 0 && (
        <span className="ml-auto label-caps !text-[8px] text-muted-foreground tabular-nums">
          · {cooldown}s
        </span>
      )}
    </div>
  ) : null

  /* ===== Input / CTA de invitado ===== */
  const inputArea = (
    <div className="glass-strong border-t border-border/50 p-2.5">
      {canChat ? (
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={cooldown > 0 ? `Espera ${cooldown}s para escribir de nuevo...` : 'Escribe un mensaje...'}
            maxLength={500}
            className="rounded-sm glass h-9"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || cooldown > 0}
            title={cooldown > 0 ? `Antiflood: espera ${cooldown}s` : 'Enviar'}
            className="btn-gradient-primary shrink-0 rounded-sm h-9 w-9"
          >
            {cooldown > 0 ? (
              <span className="text-[10px] font-bold tabular-nums">{cooldown}</span>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      ) : (
        <div className="frame-double bg-secondary/40 p-3 text-center">
          <p className="label-caps !text-[9px] mb-1.5">Únete a la charla</p>
          <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">
            {isGuest
              ? 'Crea una cuenta gratis para escribir en el chat mundial'
              : 'Entra con tu cuenta para escribir en el chat mundial'}
          </p>
          <Button
            size="sm"
            className="btn-gradient-primary w-full rounded-sm gap-1.5"
            onClick={() => openAuth(isGuest ? 'register' : 'login')}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {isGuest ? 'Crear cuenta' : 'Iniciar sesión'}
          </Button>
        </div>
      )}
    </div>
  )

  /* ===== Contenido lateral (drawer + panel desktop) ===== */
  const chatContent = (
    <div className="flex h-full flex-col">
      {/* Header — cabecera editorial */}
      <div className="glass-strong border-b border-border/50 px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm frame-double bg-primary text-primary-foreground">
              {chatTab === 'world' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="font-display font-bold text-base leading-tight">
                {chatTab === 'world' ? t('Chat Mundial') : t('Mensajes privados')}
              </h3>
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', isConnected ? 'bg-olive-400 live-pulse' : 'bg-muted-foreground/50')} />
                <span className="label-caps !text-[9px] !tracking-[0.12em]">
                  {chatTab === 'world' ? t('En vivo · nadie ve quién está aquí 🤫') : t('Tus chats 1 a 1 🔒')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {chatTab === 'world' && (
              <ChatOptionsMenu
                isFull={false}
                canChat={!!canChat}
                onClearLocal={handleClearLocal}
                onDeleteAllMine={handleDeleteAllMine}
              />
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={toggleChat}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs: Mundial / Privados */}
        <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-md bg-secondary/50 p-1">
          <TabButton active={chatTab === 'world'} onClick={() => setChatTab('world')} icon={<Globe className="h-3 w-3" />} label={t('Mundial')} />
          <TabButton active={chatTab === 'dm'} onClick={() => setChatTab('dm')} icon={<Mail className="h-3 w-3" />} label={t('Privados')} badge={dmUnread} />
        </div>
      </div>

      {chatTab === 'world' ? (
        <>
          {messagesArea}
          {emojiRow}
          {inputArea}
        </>
      ) : (
        <DMView variant={variant} />
      )}
    </div>
  )

  /* ============================================================
     VISTA COMPLETA (página Chat Mundial)
     Cabecera de gaceta + sala enmarcada + columna lateral + teletipo
     ============================================================ */
  if (isFull) {
    return (
      <div className="space-y-5">
        {/* ===== Masthead de la gaceta ===== */}
        <header className="relative text-center pt-2 pb-1">
          <p className="label-caps opacity-80">
            {chatTab === 'world' ? 'La plaza pública · Edición continua' : 'Solo para ti y tu contacto 🔒'}
          </p>
          <h1 className="text-page mt-1.5 flex items-center justify-center gap-3">
            {chatTab === 'world' ? (
              <Globe className="h-7 w-7 text-primary hidden sm:block" />
            ) : (
              <Mail className="h-7 w-7 text-primary hidden sm:block" />
            )}
            {chatTab === 'world' ? 'Chat Mundial' : 'Mensajes privados'}
          </h1>
          <div className="rule-ornate w-56 mx-auto mt-3 opacity-80">
            <span className="text-[9px] leading-none">◆</span>
          </div>
          <p className="text-meta italic mt-2.5">
            {chatTab === 'world'
              ? 'La conversación es en tiempo real y 100% privada — nadie sabe quién está conectado, pasa la voz a tus devs favoritos'
              : 'Conversaciones 1 a 1 en tiempo real — guardadas de forma segura, solo ustedes las leen'}
          </p>
        </header>

        <div className="grid lg:grid-cols-[1fr_17rem] gap-4 items-start">
          {/* ===== Sala de chat enmarcada ===== */}
          <div className="glass-card frame-double flex h-[calc(100vh-19rem)] min-h-[26rem] max-h-[46rem] flex-col overflow-hidden">
            {/* Barra superior fina de la sala */}
            <div className="glass-strong border-b border-border/50 px-4 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('h-2 w-2 rounded-full shrink-0', isConnected ? 'bg-olive-400 live-pulse' : 'bg-muted-foreground/50')} />
                <span className="label-caps !text-[10px] truncate">
                  {chatTab === 'world' ? 'En vivo · sala privada 🤫' : 'Chats 1 a 1 🔒'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Tabs: Mundial / Privados */}
                <div className="grid grid-cols-2 gap-1 rounded-md bg-secondary/50 p-1">
                  <TabButton active={chatTab === 'world'} onClick={() => setChatTab('world')} icon={<Globe className="h-3 w-3" />} label="Mundial" />
                  <TabButton active={chatTab === 'dm'} onClick={() => setChatTab('dm')} icon={<Mail className="h-3 w-3" />} label="Privados" badge={dmUnread} />
                </div>
                {chatTab === 'world' && (
                  <ChatOptionsMenu
                    isFull
                    canChat={!!canChat}
                    onClearLocal={handleClearLocal}
                    onDeleteAllMine={handleDeleteAllMine}
                  />
                )}
              </div>
            </div>

            {chatTab === 'world' ? (
              <>
                {messagesArea}
                {emojiRow}
                {inputArea}
              </>
            ) : (
              <DMView variant={variant} />
            )}
          </div>

          {/* ===== Columna lateral de la sala ===== */}
          <div className="hidden lg:flex flex-col gap-4">
            {/* Reglas del club */}
            <div className="glass-card frame-double p-4">
              <div className="flex items-center gap-2 mb-3">
                <ScrollText className="h-3.5 w-3.5 text-primary" />
                <p className="label-caps">Reglas del club</p>
              </div>
              <ol className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                <li className="flex gap-2">
                  <span className="font-display font-bold text-primary shrink-0">I.</span>
                  Sé amable — aquí todos somos devs aprendiendo.
                </li>
                <li className="flex gap-2">
                  <span className="font-display font-bold text-primary shrink-0">II.</span>
                  Sin spam ni autopromoción compulsiva.
                </li>
                <li className="flex gap-2">
                  <span className="font-display font-bold text-primary shrink-0">III.</span>
                  Comparte tu devlog y da feedback con cariño.
                </li>
              </ol>
            </div>

            {/* Sello de la plaza — decoración de goma */}
            <div className="flex justify-center py-1">
              <div className="stamp-rubber flex h-28 w-28 flex-col items-center justify-center text-center gap-0.5 select-none">
                <span className="label-caps !text-[7px] !tracking-[0.2em]">Plaza</span>
                <span className="font-display text-3xl leading-none font-bold">★</span>
                <span className="label-caps !text-[7px] !tracking-[0.2em]">DevPlay</span>
                <span className="text-[8px] text-muted-foreground italic mt-0.5">desde 2025</span>
              </div>
            </div>

            {/* Espacio de patrocinador 📢 */}
            <AdSlot />

            <p className="text-center text-xs text-muted-foreground italic leading-relaxed px-2">
              “La plaza nunca duerme —<br />conecta con devs de todo el mundo.”
            </p>
          </div>
        </div>

        {/* ===== Temas de hoy ===== */}
        <div className="text-center">
          <p className="label-caps mb-2.5">Temas de hoy en la plaza</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['#Devlogs', '#Betas', '#PixelArt', '#GameJams', '#Playtesting', '#Speedruns', '#Audio'].map((topic) => (
              <span
                key={topic}
                className="label-caps !text-[9px] border border-border bg-secondary/50 px-2.5 py-1 rounded-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/40 transition cursor-default"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ============================================================
     Panel lateral (desktop) + drawer (móvil)
     ============================================================ */
  return (
    <>
      <aside
        data-tour="chat-panel"
        className="hidden lg:flex w-80 shrink-0 flex-col sticky top-16 h-[calc(100vh-4rem)] glass border-l border-border/50"
      >
        {chatContent}
      </aside>

      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleChat}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col glass-strong lg:hidden"
            >
              {chatContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function ChatBubble({ msg, isMine, onDelete }: { msg: ChatMessage; isMine: boolean; onDelete: (id: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const openDM = useUIStore((s) => s.openDM)

  if (msg.type === 'system') {
    return (
      <div className="flex items-center justify-center py-1">
        <span className="label-caps !text-[9px] bg-secondary/60 px-2.5 py-1 rounded-sm">
          {msg.content}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('group relative flex gap-2', isMine && 'flex-row-reverse')}>
      <UserAvatar username={msg.username} avatar={msg.avatar} size="sm" className="mt-0.5 shrink-0" />
      <div className={cn('min-w-0 max-w-[80%]', isMine && 'items-end flex flex-col')}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn('text-xs font-semibold', isMine ? 'text-primary' : '')}>
            {msg.username}
          </span>
          <TimeAgo date={msg.createdAt} className="text-[10px]" />
        </div>
        {/* Burbuja — cuadrada vintage, terracota para mí */}
        <div
          className={cn(
            'inline-block w-fit max-w-full rounded-sm px-2.5 py-1.5 border',
            isMine
              ? 'bg-primary text-primary-foreground border-primary/40'
              : 'bg-secondary/70 border-border/50'
          )}
        >
          <p className="text-sm break-words leading-relaxed">
            {filterProfanity(msg.content)}
          </p>
        </div>
      </div>

      {/* 3 puntos — solo visibles al hover */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          'absolute top-0 transition-opacity z-10',
          isMine ? 'left-0' : 'right-0',
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <MoreVerticalIcon />
      </button>

      {/* Menu desplegable */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setMenuOpen(false); setConfirmDel(false) }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'absolute top-5 z-50 w-36 glass-strong rounded-md border border-border/50 shadow-lg overflow-hidden',
                isMine ? 'left-0' : 'right-0'
              )}
            >
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(filterProfanity(msg.content))
                  setCopied(true)
                  setTimeout(() => { setCopied(false); setMenuOpen(false) }, 1000)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-secondary/60 transition"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-olive-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              {isMine && (
                <>
                  <div className="border-t border-border/40" />
                  <button
                    onClick={() => {
                      if (!confirmDel) {
                        setConfirmDel(true)
                        return
                      }
                      setMenuOpen(false)
                      setConfirmDel(false)
                      onDelete(msg.id)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-xs transition',
                      confirmDel ? 'bg-red-500/10 text-red-600 font-semibold' : 'text-red-500 hover:bg-secondary/60'
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmDel ? '¿Seguro? Toca de nuevo' : 'Eliminar'}
                  </button>
                </>
              )}
              {!isMine && (
                <div className="border-t border-border/40" />
              )}
              {!isMine && (
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    openDM(msg.userId)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-secondary/60 transition"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Mensaje privado
                </button>
              )}
              {!isMine && (
                <div className="border-t border-border/40" />
              )}
              {!isMine && (
                <button
                  onClick={() => {
                    import('@/services/security-service').then(s => {
                      s.securityService.report({
                        type: 'COMMENT',
                        entityId: msg.id,
                        reason: 'spam',
                      }).then(() => {
                        toast.success('Mensaje reportado')
                      }).catch(() => {
                        toast.error('Error al reportar')
                      })
                    })
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-secondary/60 transition"
                >
                  <Flag className="h-3.5 w-3.5" />
                  Reportar
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function MoreVerticalIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

// ===== Botón de pestaña (Mundial / Privados) =====
function TabButton({ active, onClick, icon, label, badge }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-sm py-1.5 text-xs font-semibold transition-all',
        active ? 'btn-gradient-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {label}
      {!!badge && badge > 0 && (
        <span className={cn(
          'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold',
          active ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
        )}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

// ===== Menú de opciones del Chat Mundial (⋯) =====
function ChatOptionsMenu({
  isFull,
  canChat,
  onClearLocal,
  onDeleteAllMine,
}: {
  isFull: boolean
  canChat: boolean
  onClearLocal: () => void
  onDeleteAllMine: () => void
}) {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const { setView } = useUIStore()

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setConfirmDeleteAll(false) }}>
      <DropdownMenuTrigger asChild>
        <button
          title="Opciones del chat"
          aria-label="Opciones del chat"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-md">
        <DropdownMenuLabel className="text-xs">Opciones del chat</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isFull && (
          <DropdownMenuItem
            onClick={() => setView('chat')}
            className="gap-2 rounded-lg text-xs"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Abrir pantalla completa
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href)
            toast.success('Enlace de la sala copiado')
          }}
          className="gap-2 rounded-lg text-xs"
        >
          <Link2 className="h-3.5 w-3.5" />
          Copiar enlace de la sala
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClearLocal} className="gap-2 rounded-lg text-xs">
          <Eraser className="h-3.5 w-3.5" />
          Limpiar conversación (local)
        </DropdownMenuItem>
        {canChat && (
          <DropdownMenuItem
            onClick={() => {
              if (!confirmDeleteAll) {
                setConfirmDeleteAll(true)
                return
              }
              setConfirmDeleteAll(false)
              onDeleteAllMine()
            }}
            onSelect={(e) => e.preventDefault()}
            className={cn(
              'gap-2 rounded-lg text-xs transition-colors',
              confirmDeleteAll && 'bg-red-500/10 text-red-600 font-semibold'
            )}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
            {confirmDeleteAll ? '¿Seguro? Toca para confirmar' : 'Eliminar todos mis mensajes'}
          </DropdownMenuItem>
        )}
        {canChat && <DropdownMenuSeparator />}
        {canChat && (
          <DropdownMenuItem
            onClick={() => {
              import('@/services/security-service').then((s) => {
                s.securityService
                  .report({
                    type: 'COMMENT',
                    entityId: 'chat-mundial',
                    reason: 'other',
                    description: 'Problema en el Chat Mundial',
                  })
                  .then(() => toast.success('Reporte enviado. ¡Gracias!'))
                  .catch(() => toast.error('No se pudo enviar el reporte'))
              })
            }}
            className="gap-2 rounded-lg text-xs"
          >
            <Flag className="h-3.5 w-3.5" />
            Reportar un problema
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
