'use client'

/**
 * DMView — mensajería privada de DevPlay 💬
 * Dos modos dentro del mismo panel:
 *  - Lista de conversaciones (con no-leídos y último mensaje)
 *  - Hilo con un usuario (burbujas, envío en vivo por socket)
 * Estética retro Terracota & Crema, hermana del Chat Mundial.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail, MessageSquare, Send, UserPlus } from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useSocket } from '@/hooks/use-socket'
import { dmService, type DMConversation, type DMMessage, type DMPeer } from '@/services/devplay-service'
import { UserAvatar, TimeAgo } from '@/components/devplay/shared/shared'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DMViewProps {
  variant?: 'sidebar' | 'fullview'
}

export function DMView({ variant = 'sidebar' }: DMViewProps) {
  const { user, isGuest } = useCurrentUser()
  const { dmPeerId, setDMPeer, setDMUnread, openAuth } = useUIStore()
  const { socket } = useSocket()

  const [convos, setConvos] = useState<DMConversation[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [thread, setThread] = useState<{ peer: DMPeer; messages: DMMessage[] } | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const canDM = !!user && !isGuest

  /* ===== Lista de conversaciones ===== */
  const loadList = useCallback(async () => {
    if (!canDM) { setListLoading(false); return }
    try {
      const res = await dmService.list()
      setConvos(res.conversations)
      const total = res.conversations.reduce((acc, c) => acc + c.unread, 0)
      useUIStore.getState().setDMUnread(total)
    } catch {
      // silencioso: la lista se reintenta al volver al panel
    } finally {
      setListLoading(false)
    }
  }, [canDM])

  useEffect(() => { loadList() }, [loadList])

  /* ===== Hilo de conversación ===== */
  const openThread = useCallback(async (peerId: string) => {
    setThreadLoading(true)
    try {
      const res = await dmService.thread(peerId)
      setThread({ peer: res.peer, messages: res.messages })
      // al abrir el hilo, sus no-leídos pasan a leídos
      const fresh = await dmService.list()
      const total = fresh.conversations.reduce((acc, c) => acc + c.unread, 0)
      useUIStore.getState().setDMUnread(total)
    } catch (e: any) {
      toast.error(e?.message?.includes('conversación') ? 'No hay conversación disponible' : 'No se pudo abrir el chat')
      setThread(null)
      setDMPeer(null)
    } finally {
      setThreadLoading(false)
    }
  }, [setDMPeer])

  useEffect(() => {
    if (dmPeerId) openThread(dmPeerId)
    else setThread(null)
  }, [dmPeerId, openThread])

  /* ===== Entrega en vivo por socket ===== */
  useEffect(() => {
    if (!socket || !canDM) return
    const onDMNew = (msg: DMMessage) => {
      const me = user?.id
      if (!me) return
      const s = useUIStore.getState()
      const inThread = s.dmPeerId === msg.senderId
      if (inThread) {
        // llega al hilo abierto: agregar + marcar leído refrescando el hilo
        setThread((prev) =>
          prev && msg.senderId === prev.peer.id
            ? { ...prev, messages: [...prev.messages.filter((m) => m.id !== msg.id), msg] }
            : prev
        )
        dmService.thread(msg.senderId).then(() => {}).catch(() => {})
      }
      // badge y aviso los maneja ChatPanel; aquí solo sincronizamos la lista
      loadList()
    }
    socket.on('dm:new', onDMNew)
    return () => { socket.off('dm:new', onDMNew) }
  }, [socket, canDM, user?.id, loadList])

  /* ===== Enviar ===== */
  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if (!content || !dmPeerId || sending) return
    setSending(true)
    try {
      const res = await dmService.send(dmPeerId, content)
      setThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages.filter((m) => m.id !== res.message.id), res.message] } : prev
      )
      setInput('')
      loadList()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  // auto-scroll del hilo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread?.messages.length, dmPeerId])

  const isFull = variant === 'fullview'

  /* ===== Invitados / sin cuenta ===== */
  if (!canDM) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center px-6 gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-sm frame-double bg-secondary">
          <Mail className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-display font-bold text-foreground">Mensajes privados</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isGuest
            ? 'Crea una cuenta gratis para hablar en privado con otros devs'
            : 'Entra con tu cuenta para hablar en privado con otros devs'}
        </p>
        <Button size="sm" className="btn-gradient-primary rounded-sm gap-1.5" onClick={() => openAuth(isGuest ? 'register' : 'login')}>
          <UserPlus className="h-3.5 w-3.5" />
          {isGuest ? 'Crear cuenta' : 'Iniciar sesión'}
        </Button>
      </div>
    )
  }

  /* ===== Hilo abierto ===== */
  if (dmPeerId) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        {/* Cabecera del hilo */}
        <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-sm" onClick={() => setDMPeer(null)} title="Volver a conversaciones">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {threadLoading && !thread ? (
            <span className="label-caps !text-[10px] text-muted-foreground">Cargando…</span>
          ) : thread ? (
            <>
              <UserAvatar username={thread.peer.username} avatar={thread.peer.avatar} size="sm" className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">{thread.peer.username}</p>
                <p className="label-caps !text-[8px] text-muted-foreground">Chat privado 🔒</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Mensajes */}
        <div ref={scrollRef} className="custom-scroll paper-dots flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
          {threadLoading && !thread ? (
            <div className="flex h-full items-center justify-center">
              <span className="label-caps !text-[10px] text-muted-foreground">Abriendo conversación…</span>
            </div>
          ) : thread && thread.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-6">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-sm frame-double bg-secondary">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-display font-bold text-foreground text-sm">Rompe el hielo ✨</p>
              <p className="text-xs text-muted-foreground mt-1 italic">
                Este es el inicio de tu conversación con {thread.peer.username}
              </p>
            </div>
          ) : (
            thread?.messages.map((m) => {
              const mine = m.senderId === user?.id
              return (
                <div key={m.id} className={cn('flex gap-2', mine && 'flex-row-reverse')}>
                  {!mine && (
                    <UserAvatar username={thread!.peer.username} avatar={thread!.peer.avatar} size="sm" className="mt-0.5 shrink-0" />
                  )}
                  <div className={cn('min-w-0 max-w-[80%]', mine && 'flex flex-col items-end')}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <TimeAgo date={m.createdAt} className="text-[10px]" />
                      {mine && m.readAt && <span className="text-[10px] text-olive-500">✓ visto</span>}
                    </div>
                    <div
                      className={cn(
                        'inline-block w-fit max-w-full rounded-sm px-2.5 py-1.5 border',
                        mine ? 'bg-primary text-primary-foreground border-primary/40' : 'bg-secondary/70 border-border/50'
                      )}
                    >
                      <p className="text-sm break-words leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Input */}
        <div className="glass-strong border-t border-border/50 p-2.5 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe en privado…"
              maxLength={2000}
              className="rounded-sm glass h-9"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || sending}
              className="btn-gradient-primary shrink-0 rounded-sm h-9 w-9"
              title="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    )
  }

  /* ===== Lista de conversaciones ===== */
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className={cn('custom-scroll flex-1 overflow-y-auto p-3 space-y-2 min-h-0', isFull && 'p-4')}>
        {listLoading ? (
          <div className="flex h-32 items-center justify-center">
            <span className="label-caps !text-[10px] text-muted-foreground">Cargando conversaciones…</span>
          </div>
        ) : convos.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center text-center px-6">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-sm frame-double bg-secondary">
              <Mail className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-display font-bold text-foreground">Sin conversaciones aún</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Visita el perfil de un dev y toca <b>Mensaje</b> para empezar a hablar en privado 🔒
            </p>
          </div>
        ) : (
          convos.map((c) => (
            <button
              key={c.peerId}
              onClick={() => setDMPeer(c.peerId)}
              className="w-full flex items-center gap-2.5 rounded-sm border border-border/40 bg-secondary/30 p-2.5 text-left transition hover:bg-secondary/60 hover:border-primary/40"
            >
              <UserAvatar username={c.peer.username} avatar={c.peer.avatar} size="sm" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{c.peer.username}</span>
                  <TimeAgo date={c.lastAt} className="text-[10px] shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {c.lastMine ? 'Tú: ' : ''}{c.lastContent}
                  </p>
                  {c.unread > 0 && (
                    <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      {isFull && (
        <p className="text-center text-xs text-muted-foreground italic pb-3 px-4">
          🔒 Los mensajes privados solo los leen tú y la otra persona
        </p>
      )}
    </div>
  )
}

// Animación de entrada reutilizable para las transiciones de pestañas
export function DMTabFade({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="dm"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        className="flex flex-1 flex-col min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
