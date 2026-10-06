/**
 * Cliente de la API de DevPlay.
 *
 * La app habla exclusivamente con FastAPI (`/api/v1`). No hay Prisma ni rutas
 * intermedias: este archivo es el unico punto de contacto con el backend, asi que
 * toda diferencia de formato entre la API y los componentes se normaliza aqui.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000/api/v1'

const TOKEN_KEY = 'devplay-access-token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function fetchJson<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    // FastAPI devuelve `detail` (string o lista de errores de Pydantic).
    let message = `Error ${res.status}`
    if (typeof data?.detail === 'string') message = data.detail
    else if (Array.isArray(data?.detail) && data.detail[0]?.msg) message = data.detail[0].msg
    else if (data?.error) message = data.error
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  // Toda respuesta pasa por el traductor: es el unico lugar donde nace el
  // formato de FastAPI, asi que normalizar aqui cubre los 63 endpoints.
  return res.json().then((data: unknown) => camelizeKeys(data) as T)
}

const json = (data: unknown): RequestInit => ({ body: JSON.stringify(data) })

/* ---------------------------------------------------------------------------
 * Traduccion snake_case -> camelCase
 *
 * La API de FastAPI responde los campos tal cual estan en la base de datos
 * (`likes_count`, `created_at`, `is_guest`). Los componentes de la app siempre
 * han leido camelCase porque las rutas Prisma antiguas traducian antes de
 * responder (ver devplay/src/app/api/devplay/posts/route.ts:138).
 *
 * Al cambiar el backend entero de golpe, esa traduccion desaparecio y 150
 * componentes se quedaron leyendo campos que ya no existen. Aqui la recreamos.
 *
 * Por cada clave con guion bajo anadimos su alias en camelCase SIN borrar el
 * original, de modo que conviven los dos: un schema que declara `sentTo` y otro
 * que declara `sent_to` funcionan igual, y el codigo nuevo puede usar el nombre
 * que prefiera.
 * ------------------------------------------------------------------------ */

/** `likes_count` -> `likesCount`. Las claves ya en camelCase pasan intactas. */
function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Anade los alias en camelCase a cada objeto de la respuesta, en profundidad.
 * La profundidad maxima evita recursion infinita si la API algun dia devuelve
 * un objeto con referencias cruzadas.
 */
export function camelizeKeys<T>(value: T, depth = 0): T {
  if (depth > 8) return value
  if (Array.isArray(value)) return value.map((v) => camelizeKeys(v, depth + 1)) as T
  if (!isPlainObject(value)) return value

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value)) {
    // El valor va primero y ya camelizado: los hijos heredan la misma regla.
    const normalized = camelizeKeys(val, depth + 1)
    out[key] = normalized
    const camel = toCamel(key)
    // Si la respuesta ya traia `sentTo` explicito, ese gana (se sobrescribe
    // mas abajo cuando aparece la clave real). Aqui solo rellenamos el hueco.
    if (camel !== key && !(camel in out)) out[camel] = normalized
  }
  return out as T
}

/* ---------------------------------------------------------------------------
 * Tipos de la API
 *
 * Se declaran con los nombres reales de la BD (snake_case) y se exportan
 * envolviendo en `WithCamel`, que anade automaticamente el alias en camelCase.
 * Asi los dos nombres estan tipados sin duplicar 60 campos a mano, y los
 * componentes pueden leer `post.likesCount` igual que antes.
 * ------------------------------------------------------------------------ */

/** `likes_count` -> `likesCount` (a nivel de tipo, recursivo). */
type CamelCase<S extends string> = S extends `${infer A}_${infer B}`
  ? `${A}${Capitalize<CamelCase<B>>}`
  : S

/** El tipo original mas sus alias en camelCase. */
type WithCamel<T> = T & {
  [K in keyof T as K extends string ? CamelCase<K> : never]: T[K]
}

interface PostMediaRaw {
  url: string
  kind: 'image' | 'video'
}
export type PostMedia = WithCamel<PostMediaRaw>

interface PostAuthorRaw {
  id: string
  username: string
  full_name: string | null
  avatar: string | null
  /* La API no lo manda en el autor incrustado, pero las tarjetas comprueban el
     rol para pintar el distintivo de DEV. Sin este campo, TS lo marca como
     inexistente y el distintivo no se veria. */
  role?: string
}
export type PostAuthor = WithCamel<PostAuthorRaw>

interface BetaView {
  /* Necesario para la descarga: el endpoint va por id de beta, no de post. */
  id?: string
  postId?: string
  title: string
  genre?: string | null
  coverImage: string | null
  downloads: number
  platforms: string[]
  version?: string | null
  betaStatus: string
  tags: string[]
  description?: string | null
  screenshots: string[]
  requirements: string
  installInstructions: string
  changelog: string
  downloadType?: string | null
  fileSize?: number | null
  externalPlatform: string | null
}
export type Beta = WithCamel<BetaView>

interface StreamView {
  id?: string
  platform: string
  title: string
  isLive: boolean
  streamUrl: string
  embedUrl: string
  userId?: string
}
export type Stream = WithCamel<StreamView>

interface PostRaw {
  id: string
  type: 'POST' | 'BETA' | 'STREAM' | 'POLL'
  media: PostMediaRaw[]
  content: string | null
  repost_of_id: string | null
  /* El schema de la API lo declara opcional (`author: AuthorSummary | None`),
     pero en la base de datos un post SIEMPRE tiene autor: la columna no admite
     nulos y sin el no se podria borrar. Se tipa como obligatorio para que las
     tarjetas lean `post.author.id` sin comprobar nulos. */
  author: PostAuthorRaw
  likes_count: number
  comments_count: number
  liked_by_me: boolean
  bookmarked_by_me: boolean
  created_at: string
  updated_at: string
  /* Alias y campos que anade `postService` al hidratar. La API los devuelve
     planos y por eso no vienen en la respuesta cruda, pero la UI los usa.
     `mediaUrls` conserva los objetos media enteros ({url, kind}), no solo la URL:
     la tarjeta necesita el `kind` para decidir entre <img> y <video>.

     `user` y `mediaUrls` son obligatorios a proposito: `hydratePosts` siempre los
     rellena, asi que la tarjeta no tiene que comprobar que existan. */
  user?: PostAuthorRaw | null
  mediaUrls: PostMediaRaw[]
  /** Repostes del post. La API no lo manda; `hydratePosts` lo deja en 0 para que
   * el orden por engagement del explore no reciba `undefined` (NaN). */
  repostsCount: number
  beta?: BetaView | null
  stream?: StreamView | null
  liked?: boolean
  likedByMe?: boolean
}
export type Post = WithCamel<PostRaw>

interface CommentRaw {
  id: string
  post_id: string
  content: string
  author: PostAuthorRaw | null
  created_at: string
}
export type Comment = WithCamel<CommentRaw>

interface NotificationItemRaw {
  id: string
  type: 'LIVE' | 'FOLLOW' | 'COMMENT' | 'LIKE'
  message: string
  entity_id: string | null
  read: boolean
  from_user_id: string
  from_username: string
  created_at: string
  /* Autor incrustado. La API manda solo id y username; la campana del header
     lee el avatar de aqui para pintar la notificacion. */
  from_user?: PostAuthorRaw | null
}
export type NotificationItem = WithCamel<NotificationItemRaw>

interface CurrentUserRaw {
  id: string
  username: string
  email: string | null
  full_name: string | null
  bio: string | null
  avatar: string | null
  banner: string | null
  role: string
  is_guest: boolean
  dev_coins: number
  /* Contadores y banderas de relacion. GET /users/me no los devuelve: salen de
     /users/me/stats y GET /follow. Se declaran opcionales y las vistas los
     tratan como opcionales (ya usaban `?? 0` / `?.`). */
  /* `createdAt` se declara como `string` (no opcional) a proposito: la columna
     existe en la BD y lo rellena el mixin de timestamps, asi que siempre hay
     fecha. Declararla opcional obligaba a las vistas a comprobar nulos en dos
     sitios para pintar "Se unio hace...". */
  created_at: string
  followers_count?: number
  following_count?: number
  posts_count?: number
  is_following?: boolean
  is_followed_by?: boolean
  /* Si el visitante tiene bloqueado a este usuario. La API lo expone en
     GET /security/block/list, no en el perfil. */
  is_blocked?: boolean
  /* Campos de perfil y privacidad que el backend acepta en PATCH /users/me/profile
     pero no venia en GET /users/me. Se declaran opcionales porque el usuario
     anonimo y el invitado no los traen. */
  is_private?: boolean
  tags?: string[]
  language?: string
  location?: string | null
  website?: string | null
  profession?: string | null
  /** El perfil guarda los enlaces como JSON; se tipa como SocialLinks de la app. */
  social_links?: Record<string, string | undefined> | null
  /** El tour de bienvenida; la API lo expone aunque no lo guarde. */
  tour_completed?: boolean
}
export type CurrentUser = WithCamel<CurrentUserRaw>

interface AuthTokensRaw {
  access_token: string
  refresh_token: string
  token_type: string
}
export type AuthTokens = WithCamel<AuthTokensRaw>

  /**
 * Accion que puede pedir el Pixel Buddy: un gesto o saltar a otra vista.
 * El endpoint /buddy todavia no existe (M4), pero el tipo se declara aqui para
 * que el componente sepa que forma tiene la respuesta cuando exista.
 */
export interface BuddyAction {
  type: 'go' | 'gesture'
  value: string
}

export const api = {
  // ===== Auth =====
  register: (data: {
    email: string
    username: string
    password: string
    fullName: string
    age: number
  }) => fetchJson<{ id: string; username: string; email: string }>('/auth/register', {
    method: 'POST',
    ...json(data),
  }),

  login: (email: string, password: string) =>
    fetchJson<AuthTokens & { user: CurrentUser }>('/auth/login', {
      method: 'POST',
      ...json({ email, password }),
    }),

  createGuest: () => fetchJson<AuthTokens & { user: CurrentUser }>('/auth/guest', { method: 'POST' }),

  refresh: (refreshToken: string) =>
    fetchJson<AuthTokens>('/auth/refresh', { method: 'POST', ...json({ refresh_token: refreshToken }) }),

  logoutLocal: () => setToken(null),

  // ===== Posts =====
  getPosts: (params?: {
    authorId?: string
    skip?: number
    limit?: number
    /** Filtra por tipo de contenido. El feed usa esto para las pestañas. */
    type?: string
    /** Solo directos activos (`type=STREAM` + en directo). */
    live?: boolean
  }) => {
    const q = new URLSearchParams()
    if (params?.authorId) q.set('author_id', params.authorId)
    if (params?.skip !== undefined) q.set('skip', String(params.skip))
    if (params?.limit !== undefined) q.set('limit', String(params.limit))
    if (params?.type) q.set('type', params.type)
    if (params?.live) q.set('live', 'true')
    // La API devuelve { items, total, skip, limit }; los componentes esperan { posts }.
    return fetchJson<{ items: Post[]; total: number }>(`/posts?${q}`).then((r) => ({
      posts: r.items,
      total: r.total,
    }))
  },

  getPost: (id: string) => fetchJson<Post>(`/posts/${id}`).then((post) => ({ post })),

  createPost: (data: { content?: string | null; media?: PostMedia[] }) =>
    fetchJson<Post>('/posts', { method: 'POST', ...json(data) }).then((post) => ({ post })),

  updatePost: (id: string, data: { content?: string | null }) =>
    fetchJson<Post>(`/posts/${id}`, { method: 'PATCH', ...json(data) }).then((post) => ({ post })),

  deletePost: (id: string) => fetchJson<void>(`/posts/${id}`, { method: 'DELETE' }),

  repost: (id: string) => fetchJson<Post>(`/posts/${id}/repost`, { method: 'POST' }),

  // ===== Comentarios =====
  getComments: (postId: string) =>
    fetchJson<Comment[]>(`/posts/${postId}/comments`).then((comments) => ({ comments })),

  addComment: (postId: string, content: string) =>
    fetchJson<Comment>(`/posts/${postId}/comments`, { method: 'POST', ...json({ content }) }).then(
      (comment) => ({ comment })
    ),

  deleteComment: (postId: string, commentId: string) =>
    fetchJson<void>(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),

  // ===== Likes / bookmarks (toggle) =====
  toggleLike: (postId: string) =>
    fetchJson<{ active: boolean; count: number }>(`/posts/${postId}/likes`, { method: 'POST' }),

  toggleBookmark: (postId: string) =>
    fetchJson<{ active: boolean; count: number }>(`/posts/${postId}/bookmarks`, { method: 'POST' }),

  /* Alias con los nombres que usan los componentes. Como la API trabaja con
     toggles (un unico POST activa o desactiva), `like`/`unlike` son la misma
     llamada: no hay forma de forzar un estado, solo de alternarlo. */
  like: (postId: string) => fetchJson<any>(`/posts/${postId}/likes`, { method: 'POST' }),
  unlike: (postId: string) => fetchJson<any>(`/posts/${postId}/likes`, { method: 'POST' }),
  save: (postId: string) => fetchJson<any>(`/posts/${postId}/bookmarks`, { method: 'POST' }),
  unsave: (postId: string) => fetchJson<any>(`/posts/${postId}/bookmarks`, { method: 'POST' }),

  /** URL de descarga de una beta: la API la registra y responde. */
  betaDownloadUrl: (betaId: string) =>
    fetchJson<{ url: string; fileName?: string | null }>(`/betas/${betaId}/download`, {
      method: 'POST',
    }),

  

  // ===== Encuestas =====
  getPoll: (postId: string) => fetchJson<any>(`/posts/${postId}/poll`),

  createPoll: (
    postId: string,
    data: { question: string; options: { text: string }[]; allowMultiple?: boolean }
  ) => fetchJson<any>(`/posts/${postId}/poll`, { method: 'POST', ...json(data) }),

  votePoll: (pollId: string, optionIds: string[]) =>
    fetchJson<any>(`/polls/${pollId}/vote`, { method: 'POST', ...json({ option_ids: optionIds }) }),

  // ===== Betas =====
  getBetas: (params?: { authorId?: string; betaStatus?: string }) => {
    const q = new URLSearchParams()
    if (params?.authorId) q.set('author_id', params.authorId)
    if (params?.betaStatus) q.set('beta_status', params.betaStatus)
    return fetchJson<any[]>(`/betas?${q}`)
  },

  downloadBeta: (betaId: string) =>
    fetchJson<any>(`/betas/${betaId}/download`, { method: 'POST' }),

  /** Ficha de una beta (modal de editar y detalle). */
  getBeta: (betaId: string) => fetchJson<any>(`/betas/${betaId}`),

  /**
   * Publica una beta. Ojo: NO crea el post. La API separa ambas cosas, asi que
   * hay que llamar antes a `createPost` y pasarle aqui el `post_id` resultante.
   */
  createBeta: (data: Record<string, unknown>) =>
    fetchJson<any>('/betas', { method: 'POST', ...json(data) }),

  /** Edita la ficha de la beta (solo el autor). */
  updateBeta: (betaId: string, data: Record<string, unknown>) =>
    fetchJson<any>(`/betas/${betaId}`, { method: 'PATCH', ...json(data) }),

  // ===== Streams =====
  getLiveStreams: () => fetchJson<Stream[]>('/streams?live_only=true'),

  getStreams: (liveOnly?: boolean) =>
    fetchJson<Stream[]>(`/streams${liveOnly ? '?live_only=true' : ''}`),

  goLive: (data: { platform: string; title: string; streamUrl: string; embedUrl?: string }) =>
    fetchJson<Stream>('/streams/go-live', { method: 'POST', ...json(data) }),

  goOffline: () => fetchJson<Stream>('/streams/go-offline', { method: 'POST' }),

  // ===== Chat =====
  getChatMessages: () => fetchJson<any[]>('/chat'),

  sendChatMessage: (content: string) => fetchJson<any>('/chat', { method: 'POST', ...json({ content }) }),

  // ===== Mensajes directos =====
  getConversations: () => fetchJson<any[]>('/dm'),

  getDirectMessages: (userId: string) => fetchJson<any[]>(`/dm/${userId}`),

  sendDirectMessage: (userId: string, content: string) =>
    fetchJson<any>(`/dm/${userId}`, { method: 'POST', ...json({ content }) }),

  markConversationRead: (userId: string) =>
    fetchJson<{ user_id: string; marked: number }>(`/dm/${userId}/read`, { method: 'POST' }),

  // ===== Notificaciones =====
  getNotifications: (unreadOnly?: boolean) =>
    fetchJson<any>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),

  markNotificationRead: (id: string) =>
    fetchJson<any>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () =>
    fetchJson<{ marked: number }>('/notifications/read-all', { method: 'PATCH' }),

  deleteNotification: (id: string) => fetchJson<void>(`/notifications/${id}`, { method: 'DELETE' }),

  unreadCount: () => fetchJson<{ notifications: number; direct_messages: number }>('/notifications/unread-count'),

  // ===== Usuarios =====
  getMe: () => fetchJson<CurrentUser>('/users/me').then((user) => ({ user })),

  /** Perfil publico por @usuario, con los posts que se pintan a su lado. */
  getByUsername: (username: string) =>
    fetchJson<CurrentUser>(`/users/by-username/${encodeURIComponent(username)}`).then(async (user) => {
      /* El perfil muestra el usuario y su feed juntos, asi que se piden aqui y
         se devuelven en la misma respuesta que `user`. */
      const feed = await fetchJson<{ items: Post[] }>(
        `/posts?author_id=${encodeURIComponent(user.id)}&limit=30`
      ).catch(() => ({ items: [] as Post[] }))
      return { user, posts: feed.items }
    }),

  /** Perfil publico por id. */
  getUser: (id: string) => fetchJson<CurrentUser>(`/users/${id}`).then((user) => ({ user })),

  /** Seguidores de un usuario. */
  getFollowers: (id: string) => fetchJson<any>(`/users/${id}/followers`),

  /** A quien sigue un usuario. */
  getFollowing: (id: string) => fetchJson<any>(`/users/${id}/following`),

  /** Estadisticas de la cuenta actual (posts, seguidores,ixeles...). */
  getMyStats: () => fetchJson<any>('/users/me/stats'),

  /** Logros desbloqueados. */
  getMyAchievements: () => fetchJson<any>('/users/me/achievements'),

  /** Posts guardados. */
  getMyBookmarks: () => fetchJson<any>('/users/me/bookmarks'),

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
    /* `socialLinks` no esta en ProfileUpdateRequest: la API no expone todavia
       los enlaces del perfil. Se acepta en el tipo para que el formulario de
       edicion compile, pero se descarta antes de enviar. El tipo es `object`
       porque cada plataforma (GitHub, Twitch...) es una clave opcional distinta
       y `SocialLinks` no tiene indice de firma. */
    socialLinks?: object | null
  }) => {
    /* Se quitan los campos que ProfileUpdateRequest no acepta: mandarlos hacia
       que Pydantic los ignorase en silencio. Por ahora solo `socialLinks`. */
    const { socialLinks: _omit, ...payload } = data
    return fetchJson<CurrentUser>('/users/me/profile', {
      method: 'PATCH',
      ...json(payload),
    }).then((user) => ({ user }))
  },

  /* --- Verificacion de registro y recuperacion de contrasena --- */

  /** Paso 2 del registro: confirma el codigo de 6 digitos. */
  verifyRegister: (email: string, code: string) =>
    fetchJson<{ ok: boolean; username: string | null }>('/auth/verify-register', {
      method: 'POST',
      ...json({ email, code }),
    }),

  /** Reenvia el codigo de verificacion (en dev la API devuelve demoCode). */
  resendRegisterCode: (email: string) =>
    fetchJson<{ sent_to?: string; sentTo?: string; demo_code?: string; demoCode?: string }>(
      '/auth/verify-register',
      { method: 'POST', ...json({ email, resend: true }) }
    ),

  /** Paso 1 de forgot-password: pide el codigo por correo. */
  forgotPassword: (email: string) =>
    fetchJson<{
      ok: boolean
      message: string
      sent_to?: string
      sentTo?: string
      demo_code?: string
      demoCode?: string
    }>('/auth/forgot-password', { method: 'POST', ...json({ email }) }),

  /**
   * Paso 2 de forgot-password: valida el codigo y guarda la contrasena nueva.
   * Acepta el camino nuevo { email, code, password } y el legacy { token, password }.
   */
  resetPassword: (data: { email: string; code: string; password: string } | { token: string; password: string }) =>
    fetchJson<{ ok: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      ...json(data),
    }),

  /** Token corto para el socket de tiempo real. */
  getRealtimeToken: () => fetchJson<{ token: string }>('/realtime-token'),

  /* ------------------------------------------------------------------
   * M4 — search, discover y buddy ya existen en la API de FastAPI.
   * ---------------------------------------------------------------- */

  /** GET /search?q= — busca usuarios y posts. */
  searchUsers: (query: string) =>
    fetchJson<{ q: string; users: unknown[]; posts: unknown[] }>(
      `/search?q=${encodeURIComponent(query)}`
    ),

  /** POST /buddy — el Pixel Buddy (solo registrados; sin ZAI_API_KEY responde en modo demo). */
  askBuddy: (messages: unknown[]) =>
    fetchJson<{ reply?: string; error?: string; actions?: BuddyAction[] }>('/buddy', {
      method: 'POST',
      ...json({ messages }),
    }),
}

export default api
