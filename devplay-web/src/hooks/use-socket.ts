'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ChatMessage } from '@/types/devplay'
// Re-export para que los componentes puedan importar el tipo desde aquí
export type { ChatMessage } from '@/types/devplay'
import { chatService } from '@/services/devplay-service'
import { api } from '@/lib/devplay-api'

export interface LiveNotification {
  id: string
  userId: string
  username: string
  avatar: string | null
  title: string
  message: string
}

// URL del realtime:
//  - NEXT_PUBLIC_REALTIME_URL definida (Coolify/prod) → se usa directa.
//  - Si no (sandbox/local) → mismo origen con XTransformPort=3003.
const CUSTOM_RT_URL = process.env.NEXT_PUBLIC_REALTIME_URL || ''
const SOCKET_URL = CUSTOM_RT_URL || (typeof window !== 'undefined' ? window.location.origin : '/')
// Caddy (producción) enruta el realtime con este query param; en dev lo
// intercepta el rewrite de Next por el EIO. Como query OPT (no en la URI)
// para que el parser de socket.io-client no lo confunda con el namespace.

// ===== Token firmado para el handshake 🔐 (tarea 33: blindaje) =====
// El backend lo emite firmado (HMAC) y el realtime-service lo verifica:
// sin sesión NO hay socket — nadie puede suplantar a otro usuario.
let cachedToken: string | null = null
let tokenPromise: Promise<string | null> | null = null

function tokenUsable(t: string | null): boolean {
  if (!t) return false
  const exp = Number(t.split('.')[0])
  return Number.isFinite(exp) && exp - Date.now() > 60_000 // margen de 1 min
}

export async function ensureRealtimeToken(): Promise<string | null> {
  if (tokenUsable(cachedToken)) return cachedToken
  if (!tokenPromise) {
    tokenPromise = api
      .getRealtimeToken()
      .then((data: any) => {
        cachedToken = typeof data?.token === 'string' ? data.token : null
        return cachedToken
      })
      .catch(() => {
        cachedToken = null
        return null
      })
      .finally(() => {
        tokenPromise = null
      })
  }
  return tokenPromise
}

let socketInstance: Socket | null = null
// reintentos de conexión con refresco de token (evita bucle infinito sin sesión)
let reconnectTries = 0

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      path: '/',
      // En el sandbox, Caddy enruta el realtime con este query param.
      // Con URL propia (Coolify) no hace falta.
      ...(CUSTOM_RT_URL ? {} : { query: { XTransformPort: '3003' } }),
      // Polling puro: funciona a través de CUALQUIER proxy HTTP (Next dev,
      // Caddy/Coolify, Railway). El upgrade websocket a través del proxy dev
      // crea conexiones zombi (el upgrade nunca llega al server), así que lo
      // desactivamos. Para chat en vivo es más que suficiente.
      transports: ['polling'],
      upgrade: false,
      autoConnect: false, // conectamos tras conseguir el token 🔐
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      timeout: 15000,
      // auth con CALLBACK (API real de socket.io-client): se evalúa en CADA
      // intento de conexión → token siempre fresco. (Un `() => objeto` sin
      // llamar al cb deja el handshake colgado para siempre 🫠)
      auth: (cb: (data: Record<string, string>) => void) => cb({ token: cachedToken ?? '' }),
    })

    socketInstance.on('connect', () => {
      reconnectTries = 0
    })

    // Si el handshake falla (token vencido/ausente), refrescamos el token
    // y reintentamos un número finito de veces
    socketInstance.on('connect_error', () => {
      cachedToken = null
      if (reconnectTries >= 5) return // sin sesión de verdad: no insistir más
      reconnectTries++
      ensureRealtimeToken()
        .catch(() => null)
        .then(() => {
          const s = socketInstance
          if (s && !s.connected && !s.active) s.connect()
        })
    })
  }
  return socketInstance
}

/** Reintenta conexión (p.ej. justo después de iniciar sesión en la app) */
export function reconnectSocketWithFreshToken(): void {
  if (typeof window === 'undefined') return
  cachedToken = null
  reconnectTries = 0
  ensureRealtimeToken()
    .catch(() => null)
    .then(() => {
      const s = getSocket()
      if (!s.connected && !s.active) s.connect()
    })
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return getSocket().connected
    } catch {
      return false
    }
  })

  useEffect(() => {
    const socket = getSocket()
    let cancelled = false

    // 1) Conseguir token firmado → 2) conectar
    // (socket.disconnected es true al inicio — la condición correcta es !connected)
    ensureRealtimeToken().then(() => {
      if (!cancelled && !socket.connected && !(socket as any).active) socket.connect()
    })

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      cancelled = true
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  return { socket: typeof window !== 'undefined' ? getSocket() : null, isConnected }
}

export function useWorldChat(currentUserId: string | null | undefined, currentUsername: string | null | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const { socket, isConnected } = useSocket()
  const hasJoined = useRef(false)

  // Load initial messages + subscribe to socket events
  useEffect(() => {
    if (!socket) return

    chatService.getMessages().then(({ messages }) => {
      setMessages(messages.map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.username,
        avatar: m.user?.avatar ?? null,
        content: m.content,
        createdAt: m.createdAt,
        type: 'user' as const,
      })))
    }).catch(() => {})

    const onChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-100), msg])
    }
    // Privacidad total 🤫: el servidor ya NO emite conteos de conectados
    // ni listas de presentes — nadie sabe quién está en la sala.
    const onMessagesDeleted = (payload: { ids?: string[] }) => {
      const ids = new Set(payload?.ids ?? [])
      setMessages((prev) => prev.filter((m) => !ids.has(m.id)))
    }

    socket.on('chat:message', onChatMessage)
    socket.on('chat:message:deleted', onMessagesDeleted)

    return () => {
      socket.off('chat:message', onChatMessage)
      socket.off('chat:message:deleted', onMessagesDeleted)
    }
  }, [socket])

  // Auto-join chat when socket is connected and user info is available
  useEffect(() => {
    if (!socket || !isConnected || !currentUserId || !currentUsername) return
    if (hasJoined.current) return
    hasJoined.current = true
    // El servidor usa la identidad VERIFICADA del token; esto es solo señuelo
    socket.emit('chat:join', { userId: currentUserId, username: currentUsername })
  }, [socket, isConnected, currentUserId, currentUsername])

  // Reset join flag if socket disconnects (so we re-join on reconnect)
  useEffect(() => {
    if (!isConnected) {
      hasJoined.current = false
    }
  }, [isConnected])

  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || !currentUserId || !currentUsername) return
    socket?.emit('chat:message', {
      userId: currentUserId,
      username: currentUsername,
      content: content.trim().slice(0, 500),
    })
  }, [socket, currentUserId, currentUsername])

  // Eliminar un mensaje propio (optimista + confirmación en el servidor)
  const deleteMessage = useCallback(async (id: string): Promise<boolean> => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
    try {
      await chatService.deleteMessage(id)
      return true
    } catch {
      return false
    }
  }, [])

  // Limpiar el historial local (solo en este dispositivo)
  const clearMessages = useCallback(() => setMessages([]), [])

  // Eliminar del servidor todos mis mensajes de la sala
  const deleteMyMessages = useCallback(async (): Promise<number> => {
    try {
      const res = await chatService.deleteMyMessages()
      setMessages((prev) =>
        currentUserId ? prev.filter((m) => m.userId !== currentUserId) : prev
      )
      return res?.deleted ?? 0
    } catch {
      return 0
    }
  }, [currentUserId])

  return {
    messages,
    sendMessage,
    deleteMessage,
    clearMessages,
    deleteMyMessages,
    isConnected,
    /**
     * Conectados ahora mismo. El contador venía del mini-servicio de socket.io
     * (puerto 3003), que ya no está en el stack: la API no expone el número de
     * conectados, así que se informa 0 en vez de prometer un dato que no existe.
     */
    onlineCount: 0,
    /** El chat global es único: no hay salas a las que unirse. */
    join: () => {},
  }
}

export function useLiveNotifications(onLive: (n: LiveNotification) => void) {
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket) return
    const handler = (n: LiveNotification) => onLive(n)
    socket.on('notification:live', handler)
    return () => { socket.off('notification:live', handler) }
  }, [socket, onLive])
}
