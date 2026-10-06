'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

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
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-24 w-24',
  }
  const initials = username.slice(0, 2).toUpperCase()
  return (
    <Avatar className={cn(sizes[size], className)}>
      {avatar && <AvatarImage src={avatar} alt={username} />}
      <AvatarFallback className="bg-primary/15 text-primary font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

export function TimeAgo({ date, className }: { date: string | Date; className?: string }) {
  const d = typeof date === 'string' ? new Date(date) : date
  return (
    <span className={cn('text-xs text-muted-foreground', className)}>
      {formatDistanceToNow(d, { addSuffix: true, locale: es })}
    </span>
  )
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white',
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white live-pulse" />
      En vivo
    </span>
  )
}

export function PlatformBadge({ platform }: { platform: string }) {
  const labels: Record<string, string> = {
    TWITCH: 'Twitch',
    YOUTUBE: 'YouTube',
    KICK: 'Kick',
  }
  return (
    <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
      {labels[platform] ?? platform}
    </span>
  )
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
