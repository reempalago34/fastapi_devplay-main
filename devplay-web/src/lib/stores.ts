'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ViewId } from '@/types/devplay'

// ===== UI Store (view state, modals, sidebar) =====

interface UIState {
  // Navigation — 5 vistas principales
  currentView: ViewId
  profileUserId: string | null
  profileTab: string | null
  setView: (v: ViewId) => void
  openProfile: (userId: string, tab?: string) => void

  // Filtro de comunidad (Trending / Betas / Devs del sidebar)
  communityTab: 'trending' | null
  communitySignal: number
  setCommunityTab: (t: 'trending' | null) => void

  // Modals
  authModalOpen: boolean
  authMode: 'login' | 'register'
  createPostOpen: boolean
  createBetaOpen: boolean
  createPollOpen: boolean
  goLiveOpen: boolean
  postDetailId: string | null

  openAuth: (mode?: 'login' | 'register') => void
  closeAuth: () => void
  openCreatePost: () => void
  closeCreatePost: () => void
  openCreateBeta: () => void
  closeCreateBeta: () => void
  openCreatePoll: () => void
  closeCreatePoll: () => void
  openGoLive: () => void
  closeGoLive: () => void
  openPostDetail: (id: string) => void
  closePostDetail: () => void

  // World chat sidebar (mobile)
  chatOpen: boolean
  toggleChat: () => void

  // Mensajería privada 💬
  chatTab: 'world' | 'dm'
  setChatTab: (t: 'world' | 'dm') => void
  dmPeerId: string | null
  openDM: (peerId: string) => void   // desde fuera (perfil, chat): abre panel + hilo
  setDMPeer: (peerId: string | null) => void // navegación interna del panel
  dmUnread: number
  setDMUnread: (n: number) => void

  // Sidebar móvil
  mobileSidebarOpen: boolean
  toggleMobileSidebar: () => void
  closeMobileSidebar: () => void

  // Onboarding
  onboardingDone: boolean
  setOnboardingDone: (v: boolean) => void
  tourNonce: number
  startTour: () => void

  // Rueda de configuración del perfil (global)
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void

  // Preferencias del sidebar izquierdo (persistidas)
  sidebarCompact: boolean
  hideCommunity: boolean
  hideHelp: boolean
  setSidebarCompact: (v: boolean) => void
  setHideCommunity: (v: boolean) => void
  setHideHelp: (v: boolean) => void
  resetSidebarPrefs: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      currentView: 'explore',
      profileUserId: null,
      /* `openProfile` escribe `profileTab`, asi que el estado inicial tambien
         debe declararlo: si falta, TypeScript da error aqui y no al abrir un
         perfil. Se pone en `null` = "pestaña de posts". */
      profileTab: null,
      setView: (v) => set({ currentView: v, mobileSidebarOpen: false }),
      openProfile: (userId, tab) => set({ currentView: 'profile', profileUserId: userId, profileTab: tab ?? null, mobileSidebarOpen: false }),

      communityTab: null,
      communitySignal: 0,
      setCommunityTab: (t) => set((s) => ({ communityTab: t, communitySignal: s.communitySignal + 1 })),

      authModalOpen: false,
      authMode: 'login',
      createPostOpen: false,
      createBetaOpen: false,
      createPollOpen: false,
      goLiveOpen: false,
      postDetailId: null,

      openAuth: (mode = 'login') => set({ authModalOpen: true, authMode: mode }),
      closeAuth: () => set({ authModalOpen: false }),
      openCreatePost: () => set({ createPostOpen: true }),
      closeCreatePost: () => set({ createPostOpen: false }),
      openCreateBeta: () => set({ createBetaOpen: true }),
      closeCreateBeta: () => set({ createBetaOpen: false }),
      openCreatePoll: () => set({ createPollOpen: true }),
      closeCreatePoll: () => set({ createPollOpen: false }),
      openGoLive: () => set({ goLiveOpen: true }),
      closeGoLive: () => set({ goLiveOpen: false }),
      openPostDetail: (id) => set({ postDetailId: id }),
      closePostDetail: () => set({ postDetailId: null }),

      chatOpen: false,
      toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

      chatTab: 'world',
      setChatTab: (t) => set({ chatTab: t }),
      dmPeerId: null,
      openDM: (peerId) => set({ dmPeerId: peerId, chatTab: 'dm', chatOpen: true }),
      setDMPeer: (peerId) => set({ dmPeerId: peerId }),
      dmUnread: 0,
      setDMUnread: (n) => set({ dmUnread: Math.max(0, n) }),

      mobileSidebarOpen: false,
      toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
      closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

      onboardingDone: false,
      setOnboardingDone: (v) => set({ onboardingDone: v }),
      tourNonce: 0,
      startTour: () => set((s) => ({ tourNonce: s.tourNonce + 1 })),

      // Rueda de configuración del perfil
      settingsOpen: false,
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),

      // Preferencias del sidebar izquierdo
      sidebarCompact: false,
      hideCommunity: false,
      hideHelp: false,
      setSidebarCompact: (v) => set({ sidebarCompact: v }),
      setHideCommunity: (v) => set({ hideCommunity: v }),
      setHideHelp: (v) => set({ hideHelp: v }),
      resetSidebarPrefs: () =>
        set({ sidebarCompact: false, hideCommunity: false, hideHelp: false }),
    }),
    {
      name: 'devplay-ui',
      partialize: (s) => ({
        onboardingDone: s.onboardingDone,
        sidebarCompact: s.sidebarCompact,
        hideCommunity: s.hideCommunity,
        hideHelp: s.hideHelp,
      }),
    }
  )
)

// ===== Guest store (for guest sessions) =====
interface GuestState {
  guestUser: { id: string; username: string; isGuest: true } | null
  setGuest: (u: { id: string; username: string } | null) => void
  clearGuest: () => void
}

export const useGuestStore = create<GuestState>()(
  persist(
    (set) => ({
      guestUser: null,
      setGuest: (u) =>
        set({
          guestUser: u ? { ...u, isGuest: true as const } : null,
        }),
      clearGuest: () => set({ guestUser: null }),
    }),
    { name: 'devplay-guest' }
  )
)
