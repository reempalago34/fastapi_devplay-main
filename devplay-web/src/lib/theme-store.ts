'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Solo un tema: Terracota & Crema — retro 70s cálido, acento terracota
export type ColorTheme = 'vintage'

export interface ThemeInfo {
  id: ColorTheme
  label: string
  emoji: string
  description: string
  primary: string
  secondary: string
  background: string
  preview: { primary: string; accent: string; bg: string }
}

export const COLOR_THEMES: ThemeInfo[] = [
  {
    id: 'vintage',
    label: 'Vintage',
    emoji: '🎩',
    description: 'Terracota & Crema · Retro 70s cálido',
    primary: 'Terracota',
    secondary: 'Espresso',
    background: 'Cacao noche / Crema',
    preview: { primary: 'oklch(0.54 0.15 45)', accent: 'oklch(0.40 0.04 56)', bg: 'oklch(0.955 0.024 85)' },
  },
]

interface ThemeState {
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

export const useColorThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorTheme: 'vintage',
      setColorTheme: (theme) => set({ colorTheme: theme }),
    }),
    { name: 'devplay-color-theme' }
  )
)
