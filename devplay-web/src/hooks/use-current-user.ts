'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getToken, setToken } from '@/lib/devplay-api'
import type { CurrentUser } from '@/lib/devplay-api'

const ME_QUERY_KEY = ['devplay', 'me'] as const

/**
 * Hook de usuario actual.
 *
 * Antes usaba `useSession()` de NextAuth. Ahora la sesion es un access token JWT
 * en localStorage (`lib/devplay-api.ts`), asi que "hay sesion" = "hay token".
 * React Query sigue cacheando para que todos los componentes que llaman a
 * /users/me compartan una sola peticion.
 */
export function useCurrentUser() {
  const qc = useQueryClient()
  const [hasToken, setHasToken] = useState(false)

  // El token solo existe en el cliente, asi que se lee al montar.
  useEffect(() => {
    setHasToken(!!getToken())
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: [...ME_QUERY_KEY, hasToken ? 'authed' : 'anonymous'],
    queryFn: async () => (await api.getMe()).user,
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: false,
  })

  const user = data ?? null
  const loading = hasToken && isLoading && !user

  const isAuthed = !!user && !user.is_guest
  const isGuest = !!user?.is_guest

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
  }, [qc])

  /** Login: la API devuelve los tokens, se guardan y se recarga el usuario. */
  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password)
      setToken(result.access_token)
      setHasToken(true)
      await qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
      return result.user
    },
    [qc]
  )

  const loginAsGuest = useCallback(async () => {
    const result = await api.createGuest()
    setToken(result.access_token)
    setHasToken(true)
    await qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
    return result.user
  }, [qc])

  const logout = useCallback(() => {
    api.logoutLocal()
    setHasToken(false)
    qc.setQueryData([...ME_QUERY_KEY, 'authed'], null)
    qc.setQueryData([...ME_QUERY_KEY, 'anonymous'], null)
  }, [qc])

  return {
    user: user as CurrentUser | null,
    loading,
    isAuthed,
    isGuest,
    login,
    loginAsGuest,
    logout,
    /**
     * Alias de `logout`. El header lo llama asi para el caso de invitado, donde
     * la UION "Sesion de invitado cerrada" en vez de "Sesion cerrada". En el
     * backend es la misma operacion: borrar el token local.
     */
    logoutGuest: logout,
    refresh,
    refreshAfterLogin: refresh,
  }
}