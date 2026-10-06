'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/hooks/use-current-user'
import { api } from '@/lib/devplay-api'

/**
 * i18n ligero de DevPlay 🌐 — sin dependencias nuevas (todo libre, como manda).
 *
 * - Diccionario indexado POR el texto en español: t('Betas') → 'Betas' | 'Betas'.
 *   Si una cadena no está en el diccionario, se devuelve tal cual (español).
 * - La preferencia vive en User.language (BD) para cuentas reales y en
 *   localStorage para invitados/visitantes.
 * - Se elige desde: Configuración → Idioma.
 */

export type Lang = 'es' | 'en'

const DICT: Record<string, { es: string; en: string }> = {
  // ===== Navegación (sidebar) =====
  'Menú principal': { es: 'Menú principal', en: 'Main menu' },
  'Comunidad': { es: 'Comunidad', en: 'Community' },
  'Crear contenido': { es: 'Crear contenido', en: 'Create content' },
  'Mi biblioteca': { es: 'Mi biblioteca', en: 'My library' },
  'Ayuda': { es: 'Ayuda', en: 'Help' },
  'Navegación': { es: 'Navegación', en: 'Navigation' },
  'Crear': { es: 'Crear', en: 'Create' },
  'Inicio': { es: 'Inicio', en: 'Home' },
  'Feed principal': { es: 'Feed principal', en: 'Main feed' },
  'Descubrir': { es: 'Descubrir', en: 'Discover' },
  'Novedades y trending': { es: 'Novedades y trending', en: 'Fresh and trending' },
  'Betas': { es: 'Betas', en: 'Betas' },
  'Centro de betas': { es: 'Centro de betas', en: 'Beta center' },
  'Videos': { es: 'Videos', en: 'Videos' },
  'Gameplays y trailers': { es: 'Gameplays y trailers', en: 'Gameplays and trailers' },
  'Chat Mundial': { es: 'Chat Mundial', en: 'World Chat' },
  'Chatea con la comunidad': { es: 'Chatea con la comunidad', en: 'Chat with the community' },
  'Tienda': { es: 'Tienda', en: 'Store' },
  'Power-ups, avatar y premium': { es: 'Power-ups, avatar y premium', en: 'Power-ups, avatar and premium' },
  'Trending': { es: 'Trending', en: 'Trending' },
  'Lo más popular': { es: 'Lo más popular', en: 'The most popular' },
  'Devs': { es: 'Devs', en: 'Devs' },
  'Desarrolladores top': { es: 'Desarrolladores top', en: 'Top developers' },
  'Solo betas': { es: 'Solo betas', en: 'Betas only' },
  'Nueva publicación': { es: 'Nueva publicación', en: 'New post' },
  'Subir beta': { es: 'Subir beta', en: 'Upload beta' },
  'Subir video': { es: 'Subir video', en: 'Upload video' },
  'Crear encuesta': { es: 'Crear encuesta', en: 'Create poll' },
  'Logros': { es: 'Logros', en: 'Achievements' },
  'Reportes': { es: 'Reportes', en: 'Stats' },
  'Tour guiado': { es: 'Tour guiado', en: 'Guided tour' },
  'Opciones del sidebar': { es: 'Opciones del sidebar', en: 'Sidebar options' },
  'Modo compacto': { es: 'Modo compacto', en: 'Compact mode' },
  'Ocultar sección Comunidad': { es: 'Ocultar sección Comunidad', en: 'Hide Community section' },
  'Ocultar sección Ayuda': { es: 'Ocultar sección Ayuda', en: 'Hide Help section' },
  'Restablecer todo': { es: 'Restablecer todo', en: 'Reset all' },
  'Sidebar restablecido': { es: 'Sidebar restablecido', en: 'Sidebar reset' },

  // ===== Header =====
  'Buscar juegos, devs, betas...': { es: 'Buscar juegos, devs, betas...', en: 'Search games, devs, betas...' },

  // ===== Dock de creación =====
  'Publicación': { es: 'Publicación', en: 'Post' },
  'Subir Beta': { es: 'Subir Beta', en: 'Upload Beta' },
  'Subir Video': { es: 'Subir Video', en: 'Upload Video' },
  'Encuesta': { es: 'Encuesta', en: 'Poll' },

  // ===== Chat / DM =====
  'Mundial': { es: 'Mundial', en: 'World' },
  'Privados': { es: 'Privados', en: 'Private' },
  'Mensajes privados': { es: 'Mensajes privados', en: 'Private messages' },
  'En vivo · nadie ve quién está aquí 🤫': { es: 'En vivo · nadie ve quién está aquí 🤫', en: 'Live · nobody sees who is here 🤫' },
  'Tus chats 1 a 1 🔒': { es: 'Tus chats 1 a 1 🔒', en: 'Your 1-on-1 chats 🔒' },

  // ===== Configuración =====
  'Configuración del perfil': { es: 'Configuración del perfil', en: 'Profile settings' },
  'Privacidad': { es: 'Privacidad', en: 'Privacy' },
  'Perfil privado': { es: 'Perfil privado', en: 'Private profile' },
  'Solo tus seguidores pueden ver tu contenido': { es: 'Solo tus seguidores pueden ver tu contenido', en: 'Only your followers can see your content' },
  'Cualquiera puede ver tu perfil': { es: 'Cualquiera puede ver tu perfil', en: 'Anyone can see your profile' },
  'Logros y estadísticas': { es: 'Logros y estadísticas', en: 'Achievements and stats' },
  'Siempre privados: solo tú los ves': { es: 'Siempre privados: solo tú los ves', en: 'Always private: only you see them' },
  'Cookies': { es: 'Cookies', en: 'Cookies' },
  'Esenciales': { es: 'Esenciales', en: 'Essential' },
  'Necesarias para iniciar sesión y mantener tu tema': { es: 'Necesarias para iniciar sesión y mantener tu tema', en: 'Needed to sign in and keep your theme' },
  'Preferencias': { es: 'Preferencias', en: 'Preferences' },
  'Recuerdan tu sidebar, chat y ajustes de vista': { es: 'Recuerdan tu sidebar, chat y ajustes de vista', en: 'They remember your sidebar, chat and view settings' },
  'Analíticas': { es: 'Analíticas', en: 'Analytics' },
  'Nos ayudan a saber qué funciones se usan más': { es: 'Nos ayudan a saber qué funciones se usan más', en: 'They help us know which features are used most' },
  'Zona de peligro': { es: 'Zona de peligro', en: 'Danger zone' },
  'Eliminar mi cuenta': { es: 'Eliminar mi cuenta', en: 'Delete my account' },
  'Código al correo + contraseña para confirmar': { es: 'Código al correo + contraseña para confirmar', en: 'Code to your email + password to confirm' },
  'Idioma': { es: 'Idioma', en: 'Language' },
  'Elige el idioma de la interfaz': { es: 'Elige el idioma de la interfaz', en: 'Choose the interface language' },
  'Español': { es: 'Español', en: 'Spanish' },
  'English': { es: 'English', en: 'English' },

  // ===== Tour de bienvenida =====
  '¡Hola, bienvenida o bienvenida a DevPlay! 🎮': { es: '¡Hola, bienvenida o bienvenida a DevPlay! 🎮', en: 'Hey, welcome to DevPlay! 🎮' },
  'Esta es tu plaza retro para devs indie. Aquí puedes descubrir juegos y betas, conocer devs y compartir lo que estás creando. Te damos la vuelta rápida ✨': {
    es: 'Esta es tu plaza retro para devs indie. Aquí puedes descubrir juegos y betas, conocer devs y compartir lo que estás creando. Te damos la vuelta rápida ✨',
    en: 'This is your retro plaza for indie devs. Discover games and betas, meet devs and share what you are building. Here is the quick tour ✨',
  },
  'Todo el universo DevPlay': { es: 'Todo el universo DevPlay', en: 'The whole DevPlay universe' },
  'Desde este menú te mueves por la plaza: Inicio, Descubrir, Betas, Videos, Chat Mundial y Tienda. En "Comunidad" tienes atajos rápidos y en "Mi biblioteca" todo lo que guardaste. ✦': {
    es: 'Desde este menú te mueves por la plaza: Inicio, Descubrir, Betas, Videos, Chat Mundial y Tienda. En "Comunidad" tienes atajos rápidos y en "Mi biblioteca" todo lo que guardaste. ✦',
    en: 'This menu moves you around the plaza: Home, Discover, Betas, Videos, World Chat and Store. "Community" has quick shortcuts and "My library" keeps everything you saved. ✦',
  },
  'La plaza pública, en vivo ☕': { es: 'La plaza pública, en vivo ☕', en: 'The public plaza, live ☕' },
  'El chat mundial: devs de todo el mundo conversando en tiempo real. Preséntate, comparte tu devlog de la semana y encuentra a tus aliados para tu próximo juego.': {
    es: 'El chat mundial: devs de todo el mundo conversando en tiempo real. Preséntate, comparte tu devlog de la semana y encuentra a tus aliados para tu próximo juego.',
    en: 'The world chat: devs from everywhere talking in real time. Introduce yourself, share your weekly devlog and find allies for your next game.',
  },
  'Crea y comparte lo tuyo 🚀': { es: 'Crea y comparte lo tuyo 🚀', en: 'Create and share your stuff 🚀' },
  'Publica devlogs con fotos y videos, sube la beta de tu juego para que la prueben, lanza encuestas o anuncia tus streams. La comunidad quiere ver lo que haces.': {
    es: 'Publica devlogs con fotos y videos, sube la beta de tu juego para que la prueben, lanza encuestas o anuncia tus streams. La comunidad quiere ver lo que haces.',
    en: 'Post devlogs with photos and videos, upload your game beta for testing, run polls or announce your streams. The community wants to see what you make.',
  },
  'Pixel, tu compañero de plaza 🤖': { es: 'Pixel, tu compañero de plaza 🤖', en: 'Pixel, your plaza buddy 🤖' },
  'Este botoncito camina por la pantalla contigo. Tócalo y pregúntale lo que quieras: cómo subir una beta, ideas para tu juego o tips para conectar con otros devs.': {
    es: 'Este botoncito camina por la pantalla contigo. Tócalo y pregúntale lo que quieras: cómo subir una beta, ideas para tu juego o tips para conectar con otros devs.',
    en: 'This little button walks around the screen with you. Tap it and ask anything: how to upload a beta, ideas for your game or tips to connect with other devs.',
  },
  'Un último consejo 💛': { es: 'Un último consejo 💛', en: 'One last tip 💛' },
  'DevPlay es una plaza amable: da feedback con cariño, celebra los logros de los demás devs y cuéntanos qué estás creando esta semana. Ahora sí… ¡te toca explorar!': {
    es: 'DevPlay es una plaza amable: da feedback con cariño, celebra los logros de los demás devs y cuéntanos qué estás creando esta semana. Ahora sí… ¡te toca explorar!',
    en: 'DevPlay is a friendly plaza: give kind feedback, celebrate other devs and tell us what you are building this week. Now go… time to explore!',
  },
  'Siguiente →': { es: 'Siguiente →', en: 'Next →' },
  '← Atrás': { es: '← Atrás', en: '← Back' },
  'Explorar 🧭': { es: 'Explorar 🧭', en: 'Explore 🧭' },
}

interface LangContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** Traduce una cadena exacta del diccionario; si no existe, la devuelve tal cual */
  t: (text: string) => string
}

const LangContext = createContext<LangContextValue>({
  lang: 'es',
  setLang: () => {},
  t: (text) => text,
})

const LANG_KEY = 'devplay-lang'

export function LangProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser()
  const qc = useQueryClient()
  const [lang, setLangState] = useState<Lang>('es')

  // Preferencia inicial: cuenta real (BD) → invitado/visitante (localStorage)
  useEffect(() => {
    if (user && !user.isGuest && (user.language === 'es' || user.language === 'en')) {
      setLangState(user.language as Lang)
      return
    }
    try {
      const v = localStorage.getItem(LANG_KEY)
      if (v === 'es' || v === 'en') setLangState(v)
    } catch {}
  }, [user?.id, user?.language, user?.isGuest]) // eslint-disable-line react-hooks/exhaustive-deps

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l)
      try { localStorage.setItem(LANG_KEY, l) } catch {}
      // Cuentas reales: persistir en BD
      if (user && !user.isGuest) {
        api
          .updateProfile({ language: l })
          .then(() => qc.invalidateQueries({ queryKey: ['devplay', 'me'] }))
          .catch(() => {})
      }
    },
    [user, qc]
  )

  const t = useCallback(
    (text: string) => {
      const entry = DICT[text]
      if (!entry) return text
      return entry[lang] ?? entry.es
    },
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useT() {
  return useContext(LangContext)
}
