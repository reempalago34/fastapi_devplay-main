"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

/**
 * Toaster retro de DevPlay 🍞 — "Terracota & Crema"
 * Las clases toast-retro-* viven en globals.css: tarjeta crema con borde
 * terracota, sombra desplazada estilo serigrafía 70s y color por tipo
 * (success/error/warning/info via [data-type]).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "toast-retro group-[.toaster]:shadow-none",
          title: "toast-retro-title",
          description: "toast-retro-desc",
          actionButton: "toast-retro-action",
          cancelButton: "toast-retro-cancel",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
