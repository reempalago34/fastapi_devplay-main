'use client'

import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '@/lib/stores'
import { Header } from '@/components/devplay/layout/header'
import { Sidebar } from '@/components/devplay/layout/sidebar'
import { ChatPanel } from '@/components/devplay/layout/chat-panel'
import { CreateDock } from '@/components/devplay/layout/create-dock'
import { ExploreView } from '@/components/devplay/views/explore-view'
import { FeedView } from '@/components/devplay/feed-view'
import { DiscoverView } from '@/components/devplay/views/discover-view'
import { BetasView } from '@/components/devplay/views/betas-view'
import { ProfileView } from '@/components/devplay/views/profile-view'
import { StoreView } from '@/components/devplay/views/store-view'
import { AboutView } from '@/components/devplay/views/about-view'
import { ReportsView } from '@/components/devplay/views/reports-view'
import { AuthModal } from '@/components/devplay/auth-modal'
import { CreatePostModal } from '@/components/devplay/create-post-modal'
import { CreateBetaModal } from '@/components/devplay/create-beta-modal'
import { CreatePollModal } from '@/components/devplay/create-poll-modal'
import { PostDetailModal } from '@/components/devplay/post-detail-modal'
import { ResetPasswordModal } from '@/components/devplay/forgot-password-modal'
import { OnboardingTour } from '@/components/devplay/onboarding-tour'
import { PixelBuddy } from '@/components/devplay/buddy/pixel-buddy'
import { ProfileSettingsModal } from '@/components/devplay/modals/profile-settings-modal'
import { userService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { motion, AnimatePresence } from 'framer-motion'
import type { ViewId } from '@/types/devplay'

const VIEW_TITLES: Record<ViewId, string> = {
  explore: 'Explorar',
  feed: 'Directos en vivo',
  discover: 'Descubrir',
  chat: 'Chat Mundial',
  profile: 'Perfil',
  betas: 'Betas',
  store: 'Tienda',
  about: 'Acerca de',
  reportes: 'Reportes',
}

export default function Home() {
  const { currentView, profileUserId, openAuth, postDetailId, openPostDetail, openProfile } = useUIStore()
  const { user, loading } = useCurrentUser()
  const autoOpenTried = useRef(false)
  const [resetToken, setResetToken] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const postId = params.get('post')
    if (postId) openPostDetail(postId)

    const reset = params.get('reset')
    if (reset) {
      queueMicrotask(() => {
        setResetToken(reset)
        window.history.replaceState({}, '', window.location.pathname)
      })
    }

    // Enlace compartido de perfil: /?user=username
    const sharedUser = params.get('user')
    if (sharedUser) {
      window.history.replaceState({}, '', window.location.pathname)
      userService
        .getByUsername(sharedUser)
        .then((res) => {
          if (res.user) openProfile(res.user.id)
        })
        .catch(() => {})
    }
  }, [openPostDetail, openProfile])

  useEffect(() => {
    if (autoOpenTried.current) return
    if (!loading && !user && !resetToken) {
      autoOpenTried.current = true
      const params = new URLSearchParams(window.location.search)
      if (!params.get('post') && !params.get('reset')) {
        const t = setTimeout(() => openAuth('login'), 800)
        return () => clearTimeout(t)
      }
    }
  }, [loading, user, openAuth, resetToken])

  const isChatView = currentView === 'chat'
  const isProfileView = currentView === 'profile'

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-4xl px-3 sm:px-6 py-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={isProfileView ? `profile-${profileUserId}` : currentView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {isProfileView && profileUserId ? (
                  <ProfileView userId={profileUserId} />
                ) : currentView === 'explore' ? (
                  <ExploreView />
                ) : currentView === 'feed' ? (
                  <FeedView />
                ) : currentView === 'discover' ? (
                  <DiscoverView />
                ) : currentView === 'chat' ? (
                  <ChatPanel variant="fullview" />
                ) : currentView === 'betas' ? (
                  <BetasView />
                ) : currentView === 'store' ? (
                  <StoreView />
                ) : currentView === 'about' ? (
                  <AboutView />
                ) : currentView === 'reportes' ? (
                  <ReportsView />
                ) : (
                  <ExploreView />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {!isChatView && <ChatPanel variant="sidebar" />}
      </div>

      <AuthModal />
      <CreatePostModal />
      <CreateBetaModal />
      <CreatePollModal />
      <PostDetailModal />
      <ProfileSettingsModal />
      <CreateDock />
      <PixelBuddy />

      {resetToken && (
        <ResetPasswordModal
          open={!!resetToken}
          token={resetToken}
          onClose={() => { setResetToken(null); openAuth('login') }}
        />
      )}

      <OnboardingTour />
    </div>
  )
}
