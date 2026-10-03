'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  // Tema único: Mono (blanco y negro)
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', 'mono')
    }
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
