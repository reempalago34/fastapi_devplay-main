'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, X, FileText, Gamepad2, User as UserIcon, Clock, Trash2, TrendingUp, Hash } from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { UserAvatar, UserTags, TimeAgo } from '@/components/devplay/shared/shared'
import { getTagMeta, PREDEFINED_TAGS } from '@/types/devplay'
import { api } from '@/lib/devplay-api'
import { cn } from '@/lib/utils'

const HISTORY_KEY = 'devplay-search-history'
const MAX_HISTORY = 8

export function SearchModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const { openProfile, openPostDetail } = useUIStore()

  function loadHistory(): string[] {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  }

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setQuery('')
        setHistory(loadHistory())
      })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      // M4 (search) todavía no está en la API de FastAPI: devolvemos vacío
      // en vez de romper. Cuando exista GET /search, se cambia solo esta función.
      const res = await api.searchUsers(query)
      return res
    },
    enabled: query.trim().length >= 2,
  })

  const users = data?.users ?? []
  const posts = data?.posts ?? []
  const hasResults = users.length > 0 || posts.length > 0

  function saveHistory(term: string) {
    const newHistory = [term, ...history.filter(h => h !== term)].slice(0, MAX_HISTORY)
    setHistory(newHistory)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
  }

  function clearHistory() {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  function removeFromHistory(term: string) {
    const newHistory = history.filter(h => h !== term)
    setHistory(newHistory)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
  }

  function handleOpenProfile(userId: string) {
    if (query.trim().length >= 2) saveHistory(query.trim())
    onOpenChange(false)
    openProfile(userId)
  }

  function handleOpenPost(postId: string) {
    if (query.trim().length >= 2) saveHistory(query.trim())
    onOpenChange(false)
    openPostDetail(postId)
  }

  const trendingTags = PREDEFINED_TAGS.slice(0, 6)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-2xl max-h-[80vh] p-0 overflow-hidden rounded-lg flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar</DialogTitle>
          <DialogDescription>Busca juegos, devs y publicaciones</DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="border-b border-border/50 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca juegos, devs, betas..."
              className="pl-9 pr-9 rounded-full glass"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results / Suggestions */}
        <div className="flex-1 overflow-y-auto custom-scroll p-3">
          {query.trim().length < 2 ? (
            /* ===== Empty state: history + suggestions ===== */
            <div className="space-y-4">
              {/* History */}
              {history.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Búsquedas recientes
                    </p>
                    <button onClick={clearHistory} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5">
                      <Trash2 className="h-3 w-3" /> Limpiar
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {history.map((term, i) => (
                      <div key={i} className="flex items-center group">
                        <button
                          onClick={() => setQuery(term)}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary/60 transition flex-1 text-left"
                        >
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {term}
                        </button>
                        <button
                          onClick={() => removeFromHistory(term)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending suggestions */}
              <div>
                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Tendencias
                </p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {trendingTags.map(tag => {
                    const meta = getTagMeta(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => setQuery(meta?.label || tag.id)}
                        className="flex items-center gap-1 rounded-full glass px-2.5 py-1 text-xs font-medium transition"
                      >
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        <span>{meta?.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tip */}
              <div className="text-center py-4">
                <Search className="mx-auto mb-1.5 h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Escribe al menos 2 caracteres para buscar</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
            </div>
          ) : !hasResults ? (
            /* ===== Sin resultados ===== */
            <div className="py-10 text-center">
              <Search className="mx-auto mb-2 h-12 w-12 text-muted-foreground/30" />
              <p className="font-semibold text-sm">No encontramos resultados para "{query}"</p>
              <p className="text-xs text-muted-foreground mt-1.5">Sugerencias:</p>
              <div className="flex flex-col items-center gap-1 mt-2">
                <p className="text-xs text-muted-foreground">• Revisa la ortografía</p>
                <p className="text-xs text-muted-foreground">• Usa menos palabras</p>
                <p className="text-xs text-muted-foreground">• Prueba con otra categoría</p>
              </div>
            </div>
          ) : (
            /* ===== Results ===== */
            <div className="space-y-4">
              {/* Users */}
              {users.length > 0 && (
                <div>
                  <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    👥 Usuarios ({users.length})
                  </p>
                  <div className="space-y-1">
                    {users.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => handleOpenProfile(u.id)}
                        className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-secondary/60 transition"
                      >
                        <UserAvatar username={u.username} avatar={u.avatar} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{u.username}</p>
                          {u.bio && <p className="text-xs text-muted-foreground truncate">{u.bio}</p>}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{u.followersCount} seguidores</span>
                            <span className="text-[10px] text-muted-foreground">· {u.postsCount} posts</span>
                          </div>
                        </div>
                        <UserTags tags={u.tags} size="xs" max={2} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts / Betas */}
              {posts.length > 0 && (
                <div>
                  <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    📝 Publicaciones ({posts.length})
                  </p>
                  <div className="space-y-1">
                    {posts.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => handleOpenPost(p.id)}
                        className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-secondary/60 transition"
                      >
                        <div className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white',
                          p.type === 'BETA' ? 'bg-gradient-to-br from-amber-400 to-bronze-500' : 'bg-gradient-to-br from-wine-400 to-wine-500'
                        )}>
                          {p.type === 'BETA' ? <Gamepad2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          {p.type === 'BETA' && p.beta ? (
                            <p className="text-sm font-semibold truncate">{p.beta.title}</p>
                          ) : (
                            <p className="text-sm line-clamp-1">{p.content || '(sin texto)'}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">@{p.author.username}</span>
                            <TimeAgo date={p.createdAt} className="text-[10px]" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
