/**
 * ============================================================
 *  DEVPLAY — Capa de Servicios
 * ============================================================
 *
 * Cliente de la API de FastAPI. Mantiene los nombres de metodo que usaban los
 * componentes ({ postService.list(), chatService.getMessages()... ) para no
 * tocarlos: lo unico que cambia es a donde apuntan y como se normaliza la
 * respuesta de FastAPI.
 *
 * Toda llamada pasa por `lib/devplay-api.ts`, que anade el JWT.
 */

import { api, fetchJson } from '@/lib/devplay-api'
import type {
  Comment,
  CurrentUser,
  NotificationItem,
  Post,
  Stream,
} from '@/lib/devplay-api'

export type { Comment, CurrentUser, NotificationItem, Post, Stream }

/* ------------------------------------------------------------ Auth */

export const authService = {
  register: (data: {
    email: string
    username: string
    password: string
    fullName: string
    age: number
  }) => api.register(data),

  login: (email: string, password: string) => api.login(email, password),

  createGuest: () => api.createGuest(),

  logout: () => api.logoutLocal(),
}

/* ------------------------------------------------------------ Adaptadores */

/**
 * Los componentes de la app siempre leyeron posts "enriquecidos": el autor en
 * `post.user`, las URLs de media sueltas en `post.mediaUrls` y la ficha de la
 * beta o del directo **dentro** del propio post (`post.beta`, `post.stream`).
 *
 * FastAPI los devuelve planos: el autor se llama `author`, la media viene como
 * `media: [{url, kind}]` y betas/directos son recursos aparte unidos por `post_id`.
 * Aqui se reconstruye la forma que espera la UI, sin tocar los componentes.
 */

/** Beta de la API -> la que pintan las tarjetas. Los campos que la API no guarda
 *  (portada, capturas, requisitos...) salen con un valor por defecto para que la
 *  tarjeta no se rompa al accessearlos. */
function toBetaView(raw: any) {
  return {
    ...raw,
    coverImage: raw.coverImage ?? raw.cover_image ?? raw.fileUrl ?? raw.file_url ?? null,
    downloads: raw.downloads ?? 0,
    screenshots: raw.screenshots ?? [],
    requirements: raw.requirements ?? '',
    installInstructions: raw.installInstructions ?? raw.install_instructions ?? '',
    changelog: raw.changelog ?? '',
    externalPlatform: raw.externalPlatform ?? raw.external_platform ?? null,
  }
}

/** Directo de la API -> el que pinta la tarjeta. Los campos ya coinciden. */
function toStreamView(raw: any) {
  return { ...raw }
}

/** Post plano -> post con los alias que usa la UI. */
function toPostView(post: any) {
  const media: { url: string; kind: string }[] = post?.media ?? []
  return {
    ...post,
    // La API lo llama `author`; media y componentes lo llaman `user`.
    user: post?.user ?? post?.author ?? null,
    /* Mismo contenido que `media`, con el nombre que usan las tarjetas. Se
       copian los objetos enteros y no solo la URL porque la tarjeta necesita
       el `kind` para elegir entre <img> y <video>. */
    mediaUrls: media,
    /* `liked` es como lo llama la UI; la API responde `liked_by_me`. */
    liked: post?.liked ?? post?.liked_by_me ?? false,
    likedByMe: post?.liked_by_me ?? post?.liked ?? false,
    /* La API no lleva contador de reposts; el explore lo usa para ordenar por
       engagement, asi que se fija en 0 en lugar de `undefined` (NaN). */
    repostsCount: post?.repostsCount ?? post?.reposts_count ?? 0,
  }
}

/**
 * Cuelga la beta y el directo en los posts que los necesitan. Solo hace las
 * llamadas extra si el feed realmente trae posts de ese tipo, asi que el feed
 * normal (solo POST) no paga nada.
 */
async function hydratePosts(posts: any[]): Promise<any[]> {
  if (!Array.isArray(posts) || posts.length === 0) return []

  const enriched = posts.map(toPostView)
  const wantsBeta = enriched.some((p) => p.type === 'BETA')
  const wantsStream = enriched.some((p) => p.type === 'STREAM')
  if (!wantsBeta && !wantsStream) return enriched

  const [betas, streams] = await Promise.all([
    wantsBeta ? api.getBetas().catch(() => []) : Promise.resolve([]),
    wantsStream ? api.getStreams().catch(() => []) : Promise.resolve([]),
  ])

  const betaByPost = new Map<string, any>()
  for (const b of betas as any[]) betaByPost.set(b.postId ?? b.post_id, toBetaView(b))

  const streamByPost = new Map<string, any>()
  for (const s of streams as any[]) streamByPost.set(s.postId ?? s.post_id, toStreamView(s))

  return enriched.map((p) => {
    const beta = betaByPost.get(p.id) ?? null
    const stream = streamByPost.get(p.id) ?? null
    // `beta`/`stream` a null cuando no aplica: los componentes ya comprueban
    // `post.type === 'BETA' && post.beta` antes de usarlos.
    return beta ? { ...p, beta } : p.stream ? { ...p, stream } : p
  })
}

/* ------------------------------------------------------------ Posts */

export const postService = {
  list: async (params?: {
    authorId?: string
    limit?: number
    skip?: number
    type?: string
    live?: boolean
  }) => {
    const r = await api.getPosts({
      authorId: params?.authorId,
      limit: params?.limit,
      skip: params?.skip,
      type: params?.type,
      live: params?.live,
    })
    return { ...r, posts: await hydratePosts(r.posts) }
  },

  get: async (id: string) => {
    const r = await api.getPost(id)
    const [post] = await hydratePosts([r.post])
    return { ...r, post }
  },

  /**
   * Crea un post. Acepta tambien `type` y `poll` porque el modal de encuestas
   * los manda: en FastAPI una encuesta NO es un post con extras, son dos
   * llamadas (crear el post y luego colgarle la encuesta). Aqui se hace esa
   * orquestacion para que el modal no cambie.
   */
  create: async (data: {
    content?: string | null
    media?: { url: string; kind: 'image' | 'video' }[]
    type?: 'POST' | 'POLL' | 'BETA' | 'STREAM'
    poll?: {
      question: string
      /** Acepta textos sueltos u objetos: el modal manda `string[]`. */
      options: ({ text: string } | string)[]
      allowMultiple?: boolean
      closesAt?: string
    }
  }) => {
    /* `type` no se manda a la API: el tipo de un post lo decide el recurso que
       lo crea (una beta es POST /betas, un directo es POST /streams/go-live).
       Solo se acepta `POLL` con su bloque `poll`; el resto se ignora. */
    const r = await api.createPost({ content: data.content, media: data.media })

    if (data.poll) {
      const options = data.poll.options.map((o) =>
        typeof o === 'string' ? { text: o } : { text: o.text }
      )
      // La encuesta se cuelga del post recien creado: por eso el id sale de aqui.
      await api.createPoll(r.post.id, {
        question: data.poll.question,
        options,
        allowMultiple: data.poll.allowMultiple,
      })
    }

    return { ...r, post: toPostView(r.post) }
  },

  edit: (id: string, content: string) => api.updatePost(id, { content }),

  delete: (id: string) => api.deletePost(id),

  repost: async (id: string) => toPostView(await api.repost(id)),

  // Likes y bookmarks son toggles en la API: el POST activa o desactiva.
  like: (postId: string) => api.toggleLike(postId),
  unlike: (postId: string) => api.toggleLike(postId),
  save: (postId: string) => api.toggleBookmark(postId),
  unsave: (postId: string) => api.toggleBookmark(postId),

  // Comentarios
  getComments: (postId: string) =>
    api.getComments(postId).then((r) => ({
      ...r,
      comments: r.comments.map((c: any) => ({ ...c, user: c.user ?? c.author ?? null })),
    })),

  addComment: (postId: string, content: string) => api.addComment(postId, content),
  deleteComment: (postId: string, commentId: string) => api.deleteComment(postId, commentId),

  /* Delegados en `userService`. El perfil los pide como `postService.getStats()`
     porque los datos que devuelven son del usuario pero se muestran junto a sus
     posts. Delegar aqui evita romper las llamadas existentes en ambos sitios. */
  getStats: () => api.getMyStats(),
  getBookmarks: () => api.getMyBookmarks(),
  getAchievements: () => api.getMyAchievements(),
}

/* ------------------------------------------------------------ Encuestas */

export const pollService = {
  get: (postId: string) => api.getPoll(postId).then((poll) => ({ poll })),

  /** Alias con el nombre que usa el widget de encuesta incrustado en el post. */
  getPoll: (postId: string) => api.getPoll(postId).then((poll) => ({ poll })),

  /** Alias directo del cliente: el widget vota contra el id de la encuesta. */
  votePoll: (pollId: string, optionIds: string[]) =>
    api.votePoll(pollId, optionIds).then((r: any) => ({ poll: r.poll ?? r })),

  /* Vota contra el id de la encuesta. Acepta la encuesta a mano porque el widget
     ya la tiene cargada: si se pasa, se ahorra una peticion para resolver el id. */
  vote: (postId: string, optionIds: string[], knownPoll?: { id?: string }) => {
    const pollId = knownPoll?.id
    if (pollId) return api.votePoll(pollId, optionIds).then((r: any) => ({ poll: r.poll ?? r }))
    return api
      .getPoll(postId)
      .then((poll: any) => api.votePoll(poll.id, optionIds))
      .then((result: any) => ({ poll: result.poll ?? result }))
  },

  /**
   * Igual que `vote`, pero resuelve el id de la encuesta desde el post (para
   * cuando el que vota no la tiene a mano). Es la variante que usa el widget.
   */
  voteByPost: (postId: string, optionIds: string[]) =>
    api
      .getPoll(postId)
      .then((poll: any) => api.votePoll(poll.id, optionIds))
      .then((result: any) => ({ poll: result.poll ?? result })),
}

/* ------------------------------------------------------------ Betas */

export const betaService = {
  list: (params?: { authorId?: string; betaStatus?: string }) => api.getBetas(params),
  download: (betaId: string) => api.downloadBeta(betaId),

  /**
   * Registra la descarga y devuelve la URL. El modal la abria con `window.open`
   * de forma sincrona, pero registrar la descarga es un POST: hay que esperar.
   */
  downloadUrl: async (betaId: string) => {
    const res = await api.downloadBeta(betaId)
    return (res as any)?.url ?? ''
  },

  /**
   * Publica una beta. En FastAPI no es un post con campos extra: se crea primero
   * el post que anuncia la beta (POST /posts) y despues se cuelga la ficha
   * (POST /betas) apuntando a ese post. Se devuelve el post ya creado.
   */
  create: (data: {
    postId: string
    title: string
    description?: string | null
    downloadType?: string
    fileUrl?: string | null
    fileName?: string | null
    fileSize?: number | null
    externalUrl?: string | null
    betaStatus?: string
    genre?: string | null
    version?: string | null
    platforms?: string[]
    tags?: string[]
  }) => api.createBeta(data).then((beta: any) => ({ beta })),

  /** Ficha de una beta. El modal de editar la necesita para rellenar el form. */
  get: (betaId: string) => api.getBeta(betaId).then((beta: any) => ({ beta })),

  /** Edita la ficha de la beta (solo autor). */
  edit: (betaId: string, data: Record<string, unknown>) =>
    api.updateBeta(betaId, data).then((beta: any) => ({ beta })),
}

/* ------------------------------------------------------------ Streams */

export const streamService = {
  listLive: () => api.getLiveStreams().then((streams) => ({ streams })),
  list: (liveOnly?: boolean) => api.getStreams(liveOnly),
  /* El modal manda tambien `content` (el mensaje del directo) y `embedUrl`. La API
     acepta platform / title / streamUrl / embedUrl; `content` no existe en el
     schema de StreamGoLiveIn, asi que se descarta antes de enviarlo para no
     romper la llamada con un campo de mas. */
  goLive: (data: {
    platform: string
    title: string
    streamUrl: string
    embedUrl?: string
    content?: string
  }) =>
    api.goLive({
      platform: data.platform as any,
      title: data.title,
      streamUrl: data.streamUrl,
      embedUrl: data.embedUrl ?? '',
    }),
  goOffline: () => api.goOffline(),
}

/* ------------------------------------------------------------ Usuarios */

export const userService = {
  getMe: () => api.getMe(),

  /** Perfil publico por @usuario. Los componentes lo piden para abrir un perfil ajeno. */
  getByUsername: (username: string) => api.getByUsername(username),

  /** Perfil publico por id. */
  getUser: (id: string) => api.getUser(id),

  getFollowers: (id: string) => api.getFollowers(id),
  getFollowing: (id: string) => api.getFollowing(id),

  getStats: () => api.getMyStats(),
  getAchievements: () => api.getMyAchievements(),
  getBookmarks: () => api.getMyBookmarks(),

  /* `views/profile-view.tsx` llama a `get(username)` para abrir un perfil ajeno.
     Devuelve { user, posts } porque el perfil pinta los dos. */
  get: (usernameOrId: string) => api.getByUsername(usernameOrId),

  updateProfile: (data: {
    fullName?: string | null
    bio?: string | null
    avatar?: string | null
    banner?: string | null
    location?: string | null
    website?: string | null
    profession?: string | null
    tags?: string[] | null
    language?: 'es' | 'en' | null
    /* La API todavia no acepta `socialLinks`; `api.updateProfile` lo descarta.
       Se tipa como `object` porque cada plataforma (GitHub, Twitch...) es una
       clave opcional distinta y no todas las interfaces tienen indice. */
    socialLinks?: object | null
  }) => api.updateProfile(data),
}

/* ------------------------------------------------------------ Follow */

export const followService = {
  /* `GET /follow` responde el estado de la relacion. La firma acepta el id del
     usuario a seguir o el @usuario: la API espera un id, asi que el caso del
     nombre se resuelve antes en la vista. */
  follow: (followeeId: string) =>
    fetchJson('/follow', { method: 'POST', body: JSON.stringify({ followeeId }) }),

  unfollow: (followeeId: string) =>
    fetchJson(`/follow?followeeId=${encodeURIComponent(followeeId)}`, { method: 'DELETE' }),

  /** Estado actual: sigue o no. */
  getStatus: (followeeId: string) => fetchJson<any>(`/follow?followeeId=${encodeURIComponent(followeeId)}`),
}

/* ------------------------------------------------------------ Notificaciones */

export const notificationService = {
  /* La API manda `from_user_id` y `from_username` sueltos, sin el autor anidado,
     pero la campana del header lee `n.fromUser.username` y `n.fromUser.avatar`.
     Se reconstruye aqui para que no tenga que comprobar nulos en cada fila. */
  list: (unreadOnly?: boolean) =>
    api.getNotifications(unreadOnly).then((r: any) => ({
      notifications: (r.items ?? []).map((n: any) => ({
        ...n,
        fromUser: n.fromUser ?? {
          id: n.fromUserId ?? n.from_user_id,
          username: n.fromUsername ?? n.from_username ?? '',
          avatar: null,
          fullName: null,
        },
      })),
      unread: r.unreadCount ?? r.unread_count ?? 0,
      total: r.total ?? 0,
    })),

  markRead: (id?: string) =>
    id ? api.markNotificationRead(id) : api.markAllNotificationsRead(),

  /** Alias con el nombre que usa el header al abrir la campana. */
  markNotificationsRead: () => api.markAllNotificationsRead(),

  remove: (id: string) => api.deleteNotification(id),

  unreadCount: () => api.unreadCount(),
}

/* ------------------------------------------------------------ Chat */

/**
 * El chat global. El mundo online (`onlineCount`, `join`) y el borrado de
 * mensajes vivian en el mini-servicio de tiempo real (socket.io, puerto 3003),
 * que ya no forma parte del stack: ahora todo pasa por la API. La API expone el
 * historial y el envio por REST, pero no cuenta conectados ni borra mensajes, asi
 * que esos tres metodos se quedan vacios para que la UI no se rompa.
 */
export const chatService = {
  getMessages: () => api.getChatMessages().then((messages) => ({ messages })),
  send: (content: string) => api.sendChatMessage(content),

  /** Conectados ahora mismo. Sin endpoint: se informa 0. */
  onlineCount: () => Promise.resolve(0),

  /** Unirse al chat: no hay salas, el chat global es unico. No-op. */
  join: () => Promise.resolve(),

  /* Se aceptan los argumentos que usa el hook para no romper la llamada, pero no
     hacen nada: devuelven la forma que el socket espera y la UI se actualiza
     igual de forma optimista. */
  deleteMessage: (_messageId?: string) => Promise.resolve({ deleted: 0 }),
  deleteMyMessages: () => Promise.resolve({ deleted: 0 }),
}

/* ------------------------------------------------------------ Upload */
/**
 * M4: la API todavia no tiene endpoint de subida de archivos. Se devuelve una
 * URL vacia con el nombre original del fichero para que los formularios puedan
 * seguir mostrando el archivo elegido; cuando exista `/upload` se cambia solo
 * el cuerpo de estas dos funciones.
 */
export interface UploadResult {
  url: string
  path: string
  kind: 'media' | 'beta' | 'avatar'
  /** Nombre del archivo tal cual lo eligio el usuario. */
  originalName: string
}

const pendingUpload = (file: File, kind: 'media' | 'beta' | 'avatar'): UploadResult => ({
  url: '',
  path: '',
  kind,
  originalName: file.name,
})

export const uploadService = {
  uploadFile: (file: File, kind: 'media' | 'beta' | 'avatar' = 'media'): Promise<UploadResult> =>
    Promise.resolve(pendingUpload(file, kind)),

  upload: (file: File, kind: 'media' | 'beta' | 'avatar' = 'media'): Promise<UploadResult> =>
    Promise.resolve(pendingUpload(file, kind)),
}

/* ------------------------------------------------------------ DMs */

export interface DMPeer {
  id: string
  username: string
  avatar: string | null
  fullName: string | null
}

export interface DMMessage {
  id: string
  senderId: string
  recipientId: string
  content: string
  createdAt: string
  readAt: string | null
}

export interface DMConversation {
  peerId: string
  peer: DMPeer
  lastContent: string
  lastAt: string
  unread: number
  /* El panel de DMs marca en el listado si el ultimo mensaje lo escribiste tu,
     para ponerlo a la derecha. La API no lo expone: se deduce comparando el
     ultimo mensaje con tu propio id. */
  lastMine?: boolean
}

export const dmService = {
  list: () =>
    api.getConversations().then((rows: any[]) => ({
      conversations: rows.map(
        (r): DMConversation => ({
          peerId: r.peer_id ?? r.peerId,
          peer: {
            id: r.peer_id ?? r.peerId,
            username: r.peer_username ?? r.peerUsername,
            avatar: r.peer_avatar ?? r.peerAvatar ?? null,
            fullName: null,
          },
          lastContent: r.last_message ?? r.lastMessage,
          lastAt: r.last_message_at ?? r.lastMessageAt,
          unread: r.unread_count ?? r.unreadCount ?? 0,
        })
      ),
    })),

  thread: (userId: string) =>
    api.getDirectMessages(userId).then((messages: any[]) => ({
      peer: { id: userId, username: '', avatar: null, fullName: null } as DMPeer,
      messages: messages.map(
        (m): DMMessage => ({
          id: m.id,
          senderId: m.sender_id ?? m.senderId,
          recipientId: m.recipient_id ?? m.recipientId,
          content: m.content,
          createdAt: m.created_at ?? m.createdAt,
          readAt: m.read_at ?? m.readAt ?? null,
        })
      ),
    })),

  send: (userId: string, content: string) => api.sendDirectMessage(userId, content),

  markRead: (userId: string) => api.markConversationRead(userId),
}

/* ------------------------------------------------------------ Upload */

/* ------------------------------------------------------------ Tienda */

export interface StoreItem {
  id: string
  name: string
  description: string
  price: number
  /** Union cerrado: son las 4 categorias que la tienda conoce. La API devuelve
     el texto plano, asi que se normaliza en `getItems`. */
  category: 'powerup' | 'avatar' | 'premium' | 'bundle'
  icon: string
  imageUrl: string | null
  /* Campos que usa la vista para el efecto visual del item. La API no los
     guarda, asi que se rellenan con `null`. */
  effect: string | null
  duration: number | null
  createdAt: string
}

/**
 * Un movimiento de DevCoins. El backend solo guarda id, usuario y cantidad; el
 * tipo y la descripcion no estan persistidos, asi que se deducen del signo del
 * importe (`type`) y se dejan vacios en la UI (`description`).
 */
export interface BalanceTransaction {
  id: string
  userId: string
  amount: number
  /** Positivo = entrada, negativo = gasto. */
  type: 'purchase' | 'reward' | 'bonus' | 'admin'
  description: string
  createdAt: string
}

const STORE_CATEGORIES = ['powerup', 'avatar', 'premium', 'bundle'] as const

/** Normaliza un item de la API al tipo que usa la vista de tienda. */
function toStoreItem(raw: any): StoreItem {
  const cat = String(raw?.category ?? '').toLowerCase()
  return {
    ...raw,
    category: (STORE_CATEGORIES as readonly string[]).includes(cat)
      ? (cat as StoreItem['category'])
      : 'powerup',
    imageUrl: raw?.imageUrl ?? raw?.image_url ?? null,
    icon: raw?.icon ?? '',
    effect: raw?.effect ?? null,
    duration: raw?.duration ?? null,
    createdAt: raw?.createdAt ?? raw?.created_at ?? '',
  }
}

/** La API no guarda el motivo del movimiento; se deduce por el signo. */
function toTransaction(raw: any): BalanceTransaction {
  const amount = raw?.amount ?? 0
  return {
    ...raw,
    amount,
    type: amount >= 0 ? 'reward' : 'purchase',
    description: '',
    createdAt: raw?.createdAt ?? raw?.created_at ?? '',
  }
}

export const storeService = {
  getItems: () =>
    fetchJson<any>('/store/items').then((r) => ({
      items: (r?.items ?? []).map(toStoreItem) as StoreItem[],
    })),

  buy: (itemId: string) =>
    fetchJson<any>('/store/buy', { method: 'POST', body: JSON.stringify({ itemId }) }).then((r) => ({
      ...r,
      purchase: r?.purchase ? { ...r.purchase, item: toStoreItem(r.purchase.item) } : undefined,
    })),

  getMyItems: () =>
    fetchJson<any>('/store/my-items').then((r) => ({
      items: (r?.items ?? []).map((p: any) => ({
        ...p,
        item: toStoreItem(p.item),
      })),
    })),

  /* El balance viene con el historial de movimientos en la misma respuesta, asi
     que se separa aqui: la vista los lee en dos queries distintas. */
  getBalance: () =>
    fetchJson<{ balance: number; transactions: any[] }>('/store/balance').then((r) => ({
      balance: r.balance ?? 0,
      transactions: (r.transactions ?? []).map(toTransaction),
    })),

  /** Solo el saldo, sin historial (lo usa la campana de DevCoins). */
  getBalanceOnly: () => fetchJson<{ balance: number }>('/store/balance'),

  /** Solo el historial de movimientos. */
  getTransactions: () =>
    fetchJson<{ transactions: any[] }>('/store/balance').then((r) =>
      (r.transactions ?? []).map(toTransaction)
    ),
}

/* ------------------------------------------------------------ Descubrimiento (M4) */

/**
 * La pantalla de Descubrir pide cinco secciones. La API no tiene todavia un
 * endpoint /discover que las agrupe, asi que se arman con los endpoints que si
 * existen y se devuelven vacias las que no. Cuando Erick escriba el agregador,
 * se cambia SOLO este bloque.
 */
export interface DiscoverFeed {
  trending: any[]
  recommendedUsers: any[]
  popularBetas: any[]
  popularTags: any[]
  recent: any[]
}

export const discoverService = {
  get: async (): Promise<{ data: DiscoverFeed }> => {
    const [posts, betas, streams] = await Promise.all([
      api.getPosts({ limit: 10 }).then((r) => r.posts).catch(() => []),
      api.getBetas().catch(() => [] as any[]),
      api.getStreams().catch(() => [] as any[]),
    ])

    /* Los directos activos son lo "trending" del momento; si no hay ninguno se
       cae al feed reciente para que la seccion nunca se vea vacia. */
    const live = streams.filter((s: any) => s.isLive || s.is_live)
    const trending = live.length > 0 ? live : posts

    return {
      data: {
        trending,
        recommendedUsers: [],
        popularBetas: betas,
        popularTags: [],
        recent: posts,
      },
    }
  },
}

export default {
  authService,
  postService,
  pollService,
  betaService,
  streamService,
  userService,
  followService,
  notificationService,
  chatService,
  dmService,
  discoverService,
  uploadService,
  storeService,
}
