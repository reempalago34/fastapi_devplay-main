'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Send, Heart, MessageCircle } from 'lucide-react'
import { useUIStore } from '@/lib/stores'
import { useCurrentUser } from '@/hooks/use-current-user'
import { postService, uploadService, streamService, betaService } from '@/services/devplay-service'
import { toast } from 'sonner'
import { PostCard } from '@/components/devplay/post/post-card'
import { BetaDetailView } from '@/components/devplay/views/beta-detail-view'
import { UserAvatar, TimeAgo, ParsedContent } from '@/components/devplay/shared/shared'
import { cn } from '@/lib/utils'

export function PostDetailModal() {
  const { postDetailId, closePostDetail } = useUIStore()
  const { user, isAuthed, isGuest } = useCurrentUser()
  const { openAuth, openProfile } = useUIStore()
  const qc = useQueryClient()
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['post', postDetailId],
    queryFn: () => postService.get(postDetailId!),
    enabled: !!postDetailId,
  })

  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['comments', postDetailId],
    queryFn: () => postService.getComments(postDetailId!),
    enabled: !!postDetailId,
  })

  const canComment = isAuthed && !isGuest

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || !canComment) return
    setSubmitting(true)
    try {
      await postService.addComment(postDetailId!, commentText.trim())
      setCommentText('')
      refetchComments()
      qc.invalidateQueries({ queryKey: ['posts'] })
    } catch (err: any) {
      toast.error(err.message || 'Error al comentar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!postDetailId} onOpenChange={(o) => !o && closePostDetail()}>
      <DialogContent className="glass-strong max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Publicación</DialogTitle>
          <DialogDescription>Ver publicación y comentarios</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : data.post.type === 'BETA' ? (
          /* ===== Beta detail view (estilo tienda de juegos) ===== */
          <BetaDetailView postId={postDetailId!} />
        ) : (
          <>
            {/* Post */}
            <div className="overflow-y-auto custom-scroll flex-1">
              <PostCard post={data.post} onChange={() => qc.invalidateQueries({ queryKey: ['post', postDetailId] })} />

              {/* Comments */}
              <div className="p-4 border-t">
                <h3 className="flex items-center gap-2 mb-3 font-semibold text-sm">
                  <MessageCircle className="h-4 w-4" />
                  Comentarios
                  {commentsData && (
                    <span className="text-muted-foreground">({commentsData.comments.length})</span>
                  )}
                </h3>

                <div className="space-y-3">
                  {commentsData?.comments.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Sé el primero en comentar
                    </p>
                  ) : (
                    commentsData?.comments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <button onClick={() => openProfile(c.user.id)}>
                          <UserAvatar username={c.user.username} avatar={c.user.avatar} size="sm" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="glass rounded-lg rounded-tl-sm px-3 py-2">
                            <div className="flex items-center gap-2 mb-0.5">
                              <button
                                onClick={() => openProfile(c.user.id)}
                                className="text-xs font-semibold hover:underline"
                              >
                                {c.user.username}
                              </button>
                              <TimeAgo date={c.createdAt} className="text-[10px]" />
                            </div>
                            <ParsedContent
                              text={c.content}
                              className="text-sm whitespace-pre-wrap break-words"
                              onMention={(username) => {
                                import('@/services/devplay-service').then(s => {
                                  s.userService.getByUsername(username).then(res => {
                                    if (res.user) openProfile(res.user.id)
                                  }).catch(() => {})
                                })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Comment input */}
            <div className="border-t glass-strong p-3">
              {canComment ? (
                <form onSubmit={handleComment} className="flex gap-2">
                  <UserAvatar username={user!.username} avatar={user!.avatar} size="sm" className="shrink-0" />
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Escribe un comentario..."
                    maxLength={1000}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!commentText.trim() || submitting} className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => openAuth('login')}>
                  {isGuest ? 'Inicia sesión para comentar' : 'Inicia sesión para comentar'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
