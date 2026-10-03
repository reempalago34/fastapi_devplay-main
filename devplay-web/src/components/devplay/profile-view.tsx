'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/devplay-api'
import { followService, uploadService, userService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { toast } from 'sonner'
import { UserAvatar, TimeAgo, formatBytes } from './shared'
import { PostCard } from './post-card'
import { UserPlus, UserCheck, Settings, Radio, Download, ArrowLeft, Loader2, MessageSquare } from 'lucide-react'

export function ProfileView({ userId }: { userId: string }) {
  const { user: me, isAuthed, isGuest, refresh } = useCurrentUser()
  const { setView, openAuth, openDM } = useUIStore()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => userService.get(userId),
    enabled: !!userId,
  })

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const { user, posts = [] } = data
  const isMe = me?.id === userId
  const canFollow = isAuthed && !isGuest && !isMe
  const canMessage = isAuthed && !isGuest && !isMe && !user?.isGuest

  async function handleFollow() {
    if (!canFollow) {
      openAuth('login')
      return
    }
    setFollowLoading(true)
    try {
      if (user.isFollowing) {
        await followService.unfollow(userId)
      } else {
        await followService.follow(userId)
      }
      refetch()
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setFollowLoading(false)
    }
  }

  const betaPosts = posts.filter((p) => p.type === 'BETA')
  const normalPosts = posts.filter((p) => p.type !== 'BETA')

  return (
    <div className="space-y-4 pb-8">
      <Button variant="ghost" size="sm" onClick={() => setView('feed')} className="gap-1">
        <ArrowLeft className="h-4 w-4" />
        Volver al feed
      </Button>

      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        {/* Banner */}
        <div className="h-32 bg-gradient-to-br from-primary/30 via-primary/10 to-background relative">
          {user.banner && (
            <img src={user.banner} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="px-4 pb-4 -mt-12">
          <div className="flex items-end justify-between">
            <UserAvatar
              username={user.username}
              avatar={user.avatar}
              size="xl"
              className="ring-4 ring-background"
            />
            <div className="flex gap-2 mb-1">
              {isMe && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
              {canFollow && (
                <Button
                  size="sm"
                  onClick={handleFollow}
                  disabled={followLoading}
                  variant={user.isFollowing ? 'outline' : 'default'}
                  className="gap-1.5"
                >
                  {user.isFollowing ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5" />
                      Siguiendo
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      Seguir
                    </>
                  )}
                </Button>
              )}
              {canMessage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  title="Mensaje privado"
                  onClick={() => openDM(user.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Mensaje
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{user.username}</h1>
              {user.role === 'DEV' && (
                <Badge className="gap-1">
                  <Radio className="h-3 w-3" />
                  DEV
                </Badge>
              )}
              {user.isGuest && <Badge variant="secondary">Invitado</Badge>}
            </div>
            {user.bio && <p className="text-sm text-muted-foreground mt-1">{user.bio}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Se unió <TimeAgo date={user.createdAt} />
            </p>
            <div className="flex gap-4 mt-3 text-sm">
              <button className="hover:underline">
                <span className="font-bold">{user.followersCount}</span>{' '}
                <span className="text-muted-foreground">seguidores</span>
              </button>
              <button className="hover:underline">
                <span className="font-bold">{user.followingCount}</span>{' '}
                <span className="text-muted-foreground">siguiendo</span>
              </button>
              <span>
                <span className="font-bold">{user.postsCount}</span>{' '}
                <span className="text-muted-foreground">publicaciones</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posts">Publicaciones ({normalPosts.length})</TabsTrigger>
          <TabsTrigger value="betas">Juegos / Betas ({betaPosts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4 mt-4">
          {normalPosts.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              Sin publicaciones aún
            </div>
          ) : (
            normalPosts.map((p) => (
              <PostCard key={p.id} post={p} onChange={() => refetch()} />
            ))
          )}
        </TabsContent>

        <TabsContent value="betas" className="space-y-4 mt-4">
          {betaPosts.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              {user.role === 'DEV' ? 'Aún no ha subido betas' : 'Este usuario no es desarrollador'}
            </div>
          ) : (
            betaPosts.map((p) => (
              <PostCard key={p.id} post={p} onChange={() => refetch()} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {editing && isMe && (
        <EditProfileDialog
          open={editing}
          onClose={() => setEditing(false)}
          currentBio={user.bio}
          currentAvatar={user.avatar}
          onSaved={async () => {
            await refresh()
            refetch()
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

function EditProfileDialog({
  open,
  onClose,
  currentBio,
  currentAvatar,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  currentBio: string | null
  currentAvatar: string | null
  onSaved: () => void
}) {
  const [bio, setBio] = useState(currentBio ?? '')
  const [avatar, setAvatar] = useState(currentAvatar ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const res = await uploadService.uploadFile(f, 'avatar')
      setAvatar(res.url)
      toast.success('Foto actualizada')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.updateProfile({ bio: bio.trim() || null, avatar: avatar || null })
      toast.success('Perfil actualizado')
      onSaved()
    } catch (err: any) {
      toast.error(err.message || 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-w-md">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar username="" avatar={avatar} size="lg" />
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                Cambiar foto
              </span>
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Biografía</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ej: Dev de juegos 2D pixel art | Unity & Godot"
              maxLength={300}
              rows={3}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right">{bio.length}/300</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
