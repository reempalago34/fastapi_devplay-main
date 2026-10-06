'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Send, Users, X } from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWorldChat, type ChatMessage } from '@/hooks/use-socket'
import { UserAvatar, TimeAgo } from './shared'
import { cn } from '@/lib/utils'

export function WorldChat() {
  const { user, isAuthed, isGuest } = useCurrentUser()
  const { chatOpen, toggleChat } = useUIStore()
  const { messages, onlineCount, sendMessage, join, isConnected } = useWorldChat(user?.id, user?.username)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  /* El chat global es único: no hay salas ni "unirse". Antes el socket.io pedía
     nickname e id; con la API en REST no hace falta, así que basta con tener
     sesión para poder enviar mensajes. */
  useEffect(() => {
    if (user && isConnected) join()
  }, [user, isConnected, join])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    if (!user || isGuest) return
    sendMessage(input)
    setInput('')
  }

  const canChat = user && !isGuest

  const chatContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="glass-strong flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Chat Mundial</span>
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Users className="h-3 w-3" />
            {onlineCount}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={toggleChat}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="custom-scroll flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <MessageSquare className="mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">Sé el primero en escribir</p>
            <p className="text-xs">en el chat mundial 🌍</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} isMine={msg.userId === user?.id} />
          ))
        )}
      </div>

      {/* Input */}
      <div className="glass-strong border-t p-2">
        {canChat ? (
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe un mensaje..."
              maxLength={500}
              className="h-9"
            />
            <Button type="submit" size="icon" disabled={!input.trim()} className="h-9 w-9 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="py-2 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {isGuest ? 'Los invitados no pueden chatear' : 'Inicia sesión para chatear'}
            </p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col sticky top-16 h-[calc(100vh-4rem)] glass border-l">
        {chatContent}
      </aside>

      {/* Mobile: slide-over */}
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

function ChatBubble({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) {
  if (msg.type === 'system') {
    return (
      <div className="text-center text-[11px] text-muted-foreground italic py-1">
        {msg.content}
      </div>
    )
  }
  return (
    <div className={cn('flex gap-2', isMine && 'flex-row-reverse')}>
      <UserAvatar username={msg.username} avatar={msg.avatar} size="sm" className="mt-0.5 shrink-0" />
      <div className={cn('min-w-0 max-w-[75%]', isMine && 'items-end flex flex-col')}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn('text-xs font-semibold', isMine ? 'text-primary' : '')}>
            {msg.username}
          </span>
          <TimeAgo date={msg.createdAt} className="text-[10px]" />
        </div>
        <div
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm break-words',
            isMine
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'glass rounded-bl-sm'
          )}
        >
          {msg.content}
        </div>
      </div>
    </div>
  )
}
