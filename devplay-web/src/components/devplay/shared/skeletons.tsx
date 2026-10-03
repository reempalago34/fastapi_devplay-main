'use client'

import { cn } from '@/lib/utils'

// ===== Skeleton con animación shimmer =====
export function Shimmer({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg', className)} />
}

// Skeleton de PostCard
export function PostCardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Shimmer className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Shimmer className="h-3 w-32" />
          <Shimmer className="h-2 w-20" />
        </div>
      </div>
      <Shimmer className="h-4 w-full" />
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-48 w-full rounded-md" />
      <div className="flex gap-4">
        <Shimmer className="h-8 w-16 rounded-full" />
        <Shimmer className="h-8 w-16 rounded-full" />
        <Shimmer className="h-8 w-16 rounded-full" />
      </div>
    </div>
  )
}

// Skeleton de grid de videos/betas
export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card overflow-hidden">
          <Shimmer className="aspect-video w-full" />
          <div className="p-3 space-y-2">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ===== Empty State con ilustración SVG =====
export function EmptyState({
  icon = 'default',
  title,
  description,
  action,
}: {
  icon?: 'default' | 'search' | 'video' | 'beta' | 'chat' | 'store'
  title: string
  description?: string
  action?: React.ReactNode
}) {
  const illustrations: Record<string, React.ReactNode> = {
    default: <DefaultIllustration />,
    search: <SearchIllustration />,
    video: <VideoIllustration />,
    beta: <BetaIllustration />,
    chat: <ChatIllustration />,
    store: <StoreIllustration />,
  }

  return (
    <div className="glass-card p-12 text-center fade-in">
      <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center">
        {illustrations[icon]}
      </div>
      <h3 className="text-section mb-1">{title}</h3>
      {description && (
        <p className="text-body text-muted-foreground max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ===== Ilustraciones SVG (sin emojis, geométricas) =====
function DefaultIllustration() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none">
      <circle cx="48" cy="48" r="44" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />
      <rect x="32" y="38" width="32" height="24" rx="4" fill="var(--secondary)" />
      <circle cx="40" cy="48" r="2" fill="var(--muted-foreground)" />
      <circle cx="56" cy="48" r="2" fill="var(--muted-foreground)" />
      <path d="M40 56 L48 52 L56 56" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SearchIllustration() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none">
      <circle cx="40" cy="40" r="28" stroke="var(--border)" strokeWidth="3" />
      <line x1="60" y1="60" x2="78" y2="78" stroke="var(--muted-foreground)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="40" r="12" fill="var(--secondary)" />
      <text x="40" y="46" textAnchor="middle" fontSize="18" fill="var(--muted-foreground)" fontWeight="bold">?</text>
    </svg>
  )
}

function VideoIllustration() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none">
      <rect x="16" y="24" width="64" height="48" rx="8" fill="var(--secondary)" />
      <polygon points="42,40 42,56 58,48" fill="var(--muted-foreground)" />
      <circle cx="48" cy="48" r="36" stroke="var(--border)" strokeWidth="2" strokeDasharray="3 3" fill="none" />
    </svg>
  )
}

function BetaIllustration() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none">
      <rect x="20" y="28" width="56" height="40" rx="6" fill="var(--secondary)" />
      <rect x="28" y="36" width="20" height="14" rx="2" fill="var(--muted-foreground)" opacity="0.3" />
      <rect x="52" y="36" width="16" height="14" rx="2" fill="var(--muted-foreground)" opacity="0.3" />
      <circle cx="36" cy="60" r="3" fill="var(--muted-foreground)" />
      <circle cx="60" cy="60" r="3" fill="var(--muted-foreground)" />
      <path d="M36 60 L60 60" stroke="var(--border)" strokeWidth="2" />
    </svg>
  )
}

function ChatIllustration() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none">
      <path d="M16 32 Q16 24 24 24 L72 24 Q80 24 80 32 L80 56 Q80 64 72 64 L40 64 L28 76 L28 64 L24 64 Q16 64 16 56 Z" fill="var(--secondary)" />
      <circle cx="36" cy="44" r="3" fill="var(--muted-foreground)" />
      <circle cx="48" cy="44" r="3" fill="var(--muted-foreground)" />
      <circle cx="60" cy="44" r="3" fill="var(--muted-foreground)" />
    </svg>
  )
}

function StoreIllustration() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none">
      <path d="M20 28 L76 28 L72 40 L24 40 Z" fill="var(--secondary)" />
      <rect x="24" y="40" width="48" height="36" rx="2" fill="var(--secondary)" opacity="0.6" />
      <path d="M40 76 L40 56 Q40 52 44 52 L52 52 Q56 52 56 56 L56 76" stroke="var(--muted-foreground)" strokeWidth="3" fill="none" />
    </svg>
  )
}
