/**
 * ============================================================
 *  DEVPLAY — Capa de Tipos (Modelo de Dominio)
 * ============================================================
 *  Todas las interfaces de dominio de la aplicación.
 *  Esta es la capa base que usan servicios, hooks y vistas.
 * ============================================================
 */

// ===== Medios =====
export interface PostMedia {
  url: string
  kind: 'image' | 'video'
}

// ===== Usuario =====
// Ya no hay roles (PLAYER/DEV). Todos los usuarios son iguales.
// Cada usuario define su identidad con tags en su perfil.
export type UserRole = 'USER'

/**
 * Lista de tags preestablecidos que el usuario puede elegir en su perfil.
 * Se muestran como chips con iconos Lucide.
 */
export const PREDEFINED_TAGS: { id: string; label: string; icon: string }[] = [
  // Roles / qué haces
  { id: 'dev-2d', label: 'Dev 2D', icon: 'Layers' },
  { id: 'dev-3d', label: 'Dev 3D', icon: 'Box' },
  { id: 'tester', label: 'Tester', icon: 'Bug' },
  { id: 'pixel-artist', label: 'Pixel Artist', icon: 'Grid3x3' },
  { id: '3d-artist', label: 'Artista 3D', icon: 'Shapes' },
  { id: 'game-designer', label: 'Game Designer', icon: 'Target' },
  { id: 'composer', label: 'Compositor', icon: 'Music' },
  { id: 'sfx-designer', label: 'SFX Designer', icon: 'Volume2' },
  { id: 'writer', label: 'Guionista', icon: 'PenTool' },
  { id: 'programmer', label: 'Programador', icon: 'Code' },
  { id: 'streamer', label: 'Streamer', icon: 'Radio' },
  { id: 'community-mgr', label: 'Community Manager', icon: 'MessageSquare' },
  { id: 'ux-designer', label: 'Diseñador UX', icon: 'Palette' },
  { id: 'animator', label: 'Animador', icon: 'Film' },
  { id: 'level-designer', label: 'Level Designer', icon: 'Map' },
  // Estilos / géneros favoritos
  { id: 'pixel-art', label: 'Pixel Art', icon: 'Grid3x3' },
  { id: 'retro', label: 'Retro', icon: 'Rewind' },
  { id: 'horror', label: 'Horror', icon: 'Ghost' },
  { id: 'rpg-fan', label: 'Fan de RPG', icon: 'Sword' },
  { id: 'platformer', label: 'Plataformas', icon: 'Footprints' },
  { id: 'metroidvania', label: 'Metroidvania', icon: 'Compass' },
  { id: 'roguelike', label: 'Roguelike', icon: 'Skull' },
  { id: 'visual-novel', label: 'Novela Visual', icon: 'BookOpen' },
  // Herramientas
  { id: 'unity', label: 'Unity', icon: 'Cog' },
  { id: 'godot', label: 'Godot', icon: 'Settings' },
  { id: 'unreal', label: 'Unreal', icon: 'Zap' },
  { id: 'gamemaker', label: 'GameMaker', icon: 'Joystick' },
  { id: 'aseprite', label: 'Aseprite', icon: 'Brush' },
  { id: 'blender', label: 'Blender', icon: 'Box' },
]

export function getTagMeta(id: string): { label: string; icon: string } | undefined {
  return PREDEFINED_TAGS.find(t => t.id === id)
}

// ===== Redes sociales =====
export interface SocialLinks {
  facebook?: string
  instagram?: string
  twitter?: string
  tiktok?: string
  youtube?: string
  twitch?: string
  linkedin?: string
  github?: string
  discord?: string
}

export const SOCIAL_PLATFORMS: { key: keyof SocialLinks; label: string; emoji: string; color: string; placeholder: string }[] = [
  { key: 'twitter', label: 'X (Twitter)', emoji: '𝕏', color: 'from-gray-700 to-gray-900', placeholder: 'https://x.com/tuusuario' },
  { key: 'instagram', label: 'Instagram', emoji: '📷', color: 'from-bronze-500 to-sepia-600', placeholder: 'https://instagram.com/tuusuario' },
  { key: 'youtube', label: 'YouTube', emoji: '▶️', color: 'from-red-500 to-wine-600', placeholder: 'https://youtube.com/@tucanal' },
  { key: 'twitch', label: 'Twitch', emoji: '🟣', color: 'from-wine-500 to-wine-600', placeholder: 'https://twitch.tv/tucanal' },
  { key: 'tiktok', label: 'TikTok', emoji: '🎵', color: 'from-gray-800 to-black', placeholder: 'https://tiktok.com/@tuusuario' },
  { key: 'github', label: 'GitHub', emoji: '🐙', color: 'from-gray-600 to-gray-800', placeholder: 'https://github.com/tuusuario' },
  { key: 'discord', label: 'Discord', emoji: '💬', color: 'from-sepia-500 to-wine-600', placeholder: 'https://discord.gg/tuinivite' },
  { key: 'facebook', label: 'Facebook', emoji: '👥', color: 'from-sepia-500 to-sepia-700', placeholder: 'https://facebook.com/tuusuario' },
  { key: 'linkedin', label: 'LinkedIn', emoji: '💼', color: 'from-sepia-600 to-sepia-800', placeholder: 'https://linkedin.com/in/tuusuario' },
]

export interface UserSummary {
  id: string
  username: string
  avatar: string | null
  role?: UserRole
  tags?: string[] | null
  fullName?: string | null
}

export interface CurrentUser {
  id: string
  username: string
  email: string | null
  bio: string | null
  avatar: string | null
  banner: string | null
  role: UserRole
  isGuest: boolean
  isPrivate?: boolean
  tags?: string[] | null
  fullName?: string | null
  location?: string | null
  website?: string | null
  profession?: string | null
  birthDate?: string | null
  socialLinks?: SocialLinks | null
  lastSeen?: string | null
  createdAt?: string
  /** Tour de bienvenida: true = ya lo vio (solo se muestra a usuarios nuevos) */
  tourCompleted?: boolean
  /** Idioma de la interfaz: "es" | "en" — se cambia en Configuración */
  language?: string | null
}

export interface UserProfile {
  id: string
  username: string
  bio: string | null
  avatar: string | null
  banner: string | null
  role: UserRole
  isGuest: boolean
  tags: string[] | null
  fullName: string | null
  location: string | null
  website: string | null
  profession: string | null
  birthDate: string | null
  socialLinks: SocialLinks | null
  lastSeen: string | null
  createdAt: string
  followersCount: number
  followingCount: number
  postsCount: number
  isFollowing: boolean
  isBlocked?: boolean
  blockedMe?: boolean
}

// ===== Usuario en listas de seguidores/seguidos =====
export interface FollowListUser {
  id: string
  username: string
  avatar: string | null
  bio: string | null
  role: UserRole
  tags: string[] | null
  followersCount: number
  postsCount: number
  followedAt: string
}

// ===== Publicaciones =====
export type PostType = 'POST' | 'BETA' | 'STREAM' | 'POLL'

export type BetaStatus = 'alpha' | 'closed_beta' | 'open_beta' | 'tech_test' | 'early_access' | 'ended' | 'coming_soon'

// Iconos Lucide importados dinámicamente para evitar circular deps
// Se mapean a strings que se resuelven en el componente
export const BETA_STATUSES: { id: BetaStatus; label: string; icon: string; color: string; badgeClass: string }[] = [
  { id: 'alpha', label: 'Alpha', icon: 'FlaskConical', color: 'from-sepia-400 to-sepia-600', badgeClass: 'bg-sepia-100 text-sepia-700 dark:bg-sepia-500/20 dark:text-sepia-300' },
  { id: 'closed_beta', label: 'Beta Cerrada', icon: 'Lock', color: 'from-olive-400 to-olive-600', badgeClass: 'bg-olive-100 text-olive-700 dark:bg-olive-500/20 dark:text-olive-300' },
  { id: 'open_beta', label: 'Beta Abierta', icon: 'Unlock', color: 'from-bronze-300 to-bronze-500', badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' },
  { id: 'tech_test', label: 'Prueba Técnica', icon: 'Wrench', color: 'from-wine-400 to-wine-600', badgeClass: 'bg-wine-100 text-wine-700 dark:bg-wine-500/20 dark:text-wine-300' },
  { id: 'early_access', label: 'Acceso Anticipado', icon: 'Rocket', color: 'from-bronze-400 to-bronze-600', badgeClass: 'bg-bronze-100 text-bronze-700 dark:bg-bronze-500/20 dark:text-bronze-300' },
  { id: 'ended', label: 'Finalizada', icon: 'CircleStop', color: 'from-red-400 to-red-600', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
  { id: 'coming_soon', label: 'Próximamente', icon: 'Clock', color: 'from-gray-400 to-gray-500', badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300' },
]

export function getBetaStatusMeta(status: string | null | undefined) {
  return BETA_STATUSES.find(s => s.id === status) ?? BETA_STATUSES[2] // default open_beta
}

export interface Beta {
  id: string
  title: string
  description: string
  downloadType: 'DIRECT' | 'LINK'
  fileUrl: string | null
  fileSize: number | null
  fileName: string | null
  externalUrl: string | null
  downloads: number
  // ===== Campos nuevos =====
  betaStatus: BetaStatus
  genre: string | null
  version: string | null
  platforms: string[] | null
  tags: string[] | null
  requirements: string | null
  changelog: string | null
  installInstructions: string | null
  coverImage: string | null
  screenshots: string[] | null
  externalPlatform: string | null
}

export interface Stream {
  id: string
  userId: string
  platform: StreamPlatform
  streamUrl: string
  embedUrl: string
  title: string
  isLive: boolean
  startedAt: string | null
}

export type StreamPlatform = 'TWITCH' | 'YOUTUBE' | 'KICK'

export interface Post {
  id: string
  type: PostType
  content: string | null
  mediaUrls: PostMedia[]
  createdAt: string
  author: UserSummary
  beta: Beta | null
  stream: Stream | null
  poll: Poll | null
  repostOf: Post | null
  likesCount: number
  commentsCount: number
  repostsCount: number
  liked: boolean
}

// ===== Encuestas =====
export interface PollOption {
  id: string
  text: string
  voteCount: number
  percentage: number
}

export interface Poll {
  id: string
  question: string
  options: PollOption[]
  allowMultiple: boolean
  closesAt: string | null
  totalVotes: number
  userVotedOptionIds: string[]
}

// ===== Comentarios =====
export interface Comment {
  id: string
  postId: string
  userId: string
  content: string
  createdAt: string
  user: UserSummary
}

// ===== Notificaciones =====
export type NotificationType = 'LIVE' | 'FOLLOW' | 'COMMENT' | 'LIKE'

export interface NotificationItem {
  id: string
  userId: string
  fromUserId: string
  type: NotificationType
  message: string
  entityId: string | null
  read: boolean
  createdAt: string
  fromUser: UserSummary
}

// ===== Mensajes de Chat =====
export interface ChatMessage {
  id: string
  userId: string
  username: string
  avatar: string | null
  content: string
  createdAt: string
  type?: 'user' | 'system'
}

// ===== Tipos de Vista (navegación) =====
/**
 * Vistas de la app. `feed` es la vista de directos en vivo: es la destino del
 * boton "Ver" de la notificacion LIVE del header, asi que tiene que existir como
 * id o el `setView('feed')` cae en la vista por defecto (explore).
 */
export type ViewId =
  | 'explore'
  | 'feed'
  | 'discover'
  | 'chat'
  | 'profile'
  | 'betas'
  | 'store'
  | 'about'
  | 'reportes'

// ===== Tienda =====
export type StoreCategory = 'powerup' | 'avatar' | 'premium' | 'bundle'

export interface StoreItem {
  id: string
  name: string
  description: string
  price: number
  category: StoreCategory
  icon: string
  imageUrl: string | null
  effect: string | null
  duration: number | null
  createdAt: string
}

export interface StorePurchase {
  id: string
  userId: string
  itemId: string
  pricePaid: number
  createdAt: string
  item: StoreItem
}

export type DevCoinTransactionType = 'purchase' | 'reward' | 'bonus' | 'admin'

export interface DevCoinTransaction {
  id: string
  userId: string
  amount: number
  type: DevCoinTransactionType
  description: string
  createdAt: string
}

// ===== Payloads para crear contenido =====
export interface CreatePollPayload {
  question: string
  options: string[]
  allowMultiple?: boolean
  closesAt?: string
}

export interface CreatePostPayload {
  type: PostType
  content?: string | null
  media?: PostMedia[]
  beta?: CreateBetaPayload
  stream?: CreateStreamPayload
  poll?: CreatePollPayload
}

export interface CreateBetaPayload {
  title: string
  description: string
  downloadType: 'DIRECT' | 'LINK'
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  externalUrl?: string | null
  // Campos nuevos
  betaStatus?: BetaStatus
  genre?: string | null
  version?: string | null
  platforms?: string[]
  tags?: string[]
  requirements?: string | null
  changelog?: string | null
  installInstructions?: string | null
  coverImage?: string | null
  screenshots?: string[]
  externalPlatform?: string | null
}

export interface CreateStreamPayload {
  platform: StreamPlatform
  streamUrl: string
  embedUrl?: string
  title: string
  content?: string
}

export interface UpdateProfilePayload {
  bio?: string | null
  avatar?: string | null
  banner?: string | null
  tags?: string[]
  fullName?: string | null
  location?: string | null
  website?: string | null
  profession?: string | null
  birthDate?: string | null
  socialLinks?: SocialLinks | null
}

// ===== Respuestas de API =====
export interface AuthResponse {
  id: string
  username: string
  email?: string
  isGuest?: boolean
}

export interface UploadResult {
  url: string
  fileName: string
  originalName: string
  size: number
  path: string | null
  kind: 'media' | 'beta' | 'avatar'
}
