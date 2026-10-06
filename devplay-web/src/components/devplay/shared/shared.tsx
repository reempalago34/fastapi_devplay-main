'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { getTagMeta, getBetaStatusMeta } from '@/types/devplay'
import {
  FlaskConical, Lock, Unlock, Wrench, Rocket, CircleStop, Clock,
  Layers, Box, Bug, Grid3x3, Shapes, Target, Music, Volume2, PenTool,
  Code, Radio, MessageSquare, Palette, Film, Map, Rewind, Ghost, Sword,
  Footprints, Compass, Skull, BookOpen, Cog, Settings, Zap, Joystick, Brush,
  Tag, type LucideIcon,
} from 'lucide-react'

// Mapa de iconos para beta statuses
const BETA_STATUS_ICONS: Record<string, LucideIcon> = {
  FlaskConical, Lock, Unlock, Wrench, Rocket, CircleStop, Clock,
}

// Mapa de iconos para tags
const TAG_ICONS: Record<string, LucideIcon> = {
  Layers, Box, Bug, Grid3x3, Shapes, Target, Music, Volume2, PenTool,
  Code, Radio, MessageSquare, Palette, Film, Map, Rewind, Ghost, Sword,
  Footprints, Compass, Skull, BookOpen, Cog, Settings, Zap, Joystick, Brush,
}

// ===== Avatar =====
const AVATAR_GRADIENTS = [
  'from-wine-300 to-sepia-400',
  'from-wine-300 to-wine-400',
  'from-amber-300 to-bronze-400',
  'from-olive-300 to-sepia-400',
  'from-wine-300 to-wine-400',
  'from-bronze-300 to-sepia-400',
]

function pickGradient(username: string) {
  let sum = 0
  for (let i = 0; i < username.length; i++) sum += username.charCodeAt(i)
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length]
}

export function UserAvatar({
  username,
  avatar,
  size = 'md',
  className,
}: {
  username: string
  avatar?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-24 w-24 text-2xl',
  }
  const initials = username.slice(0, 2).toUpperCase()
  const gradient = pickGradient(username)

  return (
    <Avatar className={cn(sizes[size], 'ring-2 ring-white/40 dark:ring-white/10', className)}>
      {avatar && <AvatarImage src={avatar} alt={username} />}
      {!avatar && <AvatarImage src="/uploads/default-avatar.png" alt={username} />}
      <AvatarFallback className={cn('bg-gradient-to-br font-bold text-white', gradient)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

// ===== Tiempo relativo =====
export function TimeAgo({ date, className }: { date: string | Date; className?: string }) {
  const d = typeof date === 'string' ? new Date(date) : date
  return (
    <span className={cn('text-xs text-muted-foreground', className)}>
      {formatDistanceToNow(d, { addSuffix: true, locale: es })}
    </span>
  )
}

// ===== Badge En vivo =====
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-wine-400 to-sepia-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm shadow-wine-400/40',
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white live-pulse" />
      En vivo
    </span>
  )
}

// ===== Badge de plataforma =====
export function PlatformBadge({ platform }: { platform: string }) {
  const labels: Record<string, string> = {
    TWITCH: 'Twitch',
    YOUTUBE: 'YouTube',
    KICK: 'Kick',
  }
  const colors: Record<string, string> = {
    TWITCH: 'bg-wine-100 text-wine-700 dark:bg-wine-500/20 dark:text-wine-300',
    YOUTUBE: 'bg-wine-100 text-wine-700 dark:bg-wine-500/20 dark:text-wine-300',
    KICK: 'bg-olive-100 text-olive-700 dark:bg-olive-500/20 dark:text-olive-300',
  }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', colors[platform] ?? 'bg-secondary text-secondary-foreground')}>
      {labels[platform] ?? platform}
    </span>
  )
}

// ===== Tags de usuario (chips gris) =====
/**
 * Muestra los tags del usuario como chips gris neutro.
 * Tamaño compacto: emoji + label.
 */
export function UserTags({
  tags,
  size = 'sm',
  max = 3,
  className,
}: {
  tags: string[] | null | undefined
  size?: 'xs' | 'sm' | 'md'
  max?: number
  className?: string
}) {
  if (!tags || tags.length === 0) return null

  const shown = tags.slice(0, max)
  const remaining = tags.length - shown.length

  const sizes = {
    xs: 'text-[9px] px-1.5 py-0 gap-0.5',
    sm: 'text-[10px] px-2 py-0.5 gap-0.5',
    md: 'text-xs px-2.5 py-1 gap-1',
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown.map((tagId) => {
        const meta = getTagMeta(tagId)
        const Icon = meta ? (TAG_ICONS[meta.icon] ?? Tag) : Tag
        return (
          <span
            key={tagId}
            className={cn(
              'inline-flex items-center rounded-full font-medium bg-secondary text-secondary-foreground border border-border/60',
              sizes[size]
            )}
            title={meta?.label ?? tagId}
          >
            <Icon className="shrink-0" style={{ width: size === 'xs' ? '0.7rem' : size === 'sm' ? '0.75rem' : '1rem', height: size === 'xs' ? '0.7rem' : size === 'sm' ? '0.75rem' : '1rem' }} />
            <span>{meta?.label ?? tagId}</span>
          </span>
        )
      })}
      {remaining > 0 && (
        <span className={cn('inline-flex items-center rounded-full font-medium bg-secondary text-secondary-foreground border border-border/60', sizes[size])}>
          +{remaining}
        </span>
      )}
    </div>
  )
}

// ===== Badge de estado de beta =====
export function BetaStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const meta = getBetaStatusMeta(status)
  const Icon = BETA_STATUS_ICONS[meta.icon] ?? Unlock
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        meta.badgeClass,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

// ===== Formatear bytes =====
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ===== Icono de plataforma =====
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  // Iconos simples con SVG
  if (platform === 'TWITCH') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
      </svg>
    )
  }
  if (platform === 'YOUTUBE') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

// ===== Contenido parseado (menciones @ y hashtags #) =====
// Convierte @username y #hashtag en enlaces clicables
export function ParsedContent({ text, className, onMention, onHashtag }: {
  text: string
  className?: string
  onMention?: (username: string) => void
  onHashtag?: (tag: string) => void
}) {
  // Regex: @username (letras, números, _ , 3-20 chars) o #hashtag (letras, números, _ , 2-30 chars)
  const parts = text.split(/(@[a-zA-Z0-9_]{3,20}|#[a-zA-Z0-9_]{2,30})/g)

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          const username = part.slice(1)
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onMention?.(username)}
              onKeyDown={(e) => { if (e.key === 'Enter') onMention?.(username) }}
              className="text-primary font-medium cursor-pointer hover:underline"
            >
              {part}
            </span>
          )
        }
        if (part.startsWith('#') && part.length > 1) {
          const tag = part.slice(1)
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onHashtag?.(tag)}
              onKeyDown={(e) => { if (e.key === 'Enter') onHashtag?.(tag) }}
              className="text-primary font-medium cursor-pointer hover:underline"
            >
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}
