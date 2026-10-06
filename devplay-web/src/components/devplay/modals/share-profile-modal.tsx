'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  X, Link2, Check, Share2, Send, Facebook, Twitter, Mail, UserPlus, MessageCircle,
} from 'lucide-react'

/**
 * Compartir perfil con opciones múltiples:
 * WhatsApp, X, Facebook, Telegram, Email, copiar enlace y compartir nativo.
 */
export function ShareProfileModal({
  open,
  onClose,
  username,
}: {
  open: boolean
  onClose: () => void
  username: string
}) {
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?user=${username}` : ''
  const shareText = `Sígueme en DevPlay, la plaza de los devs indie 🎮`

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
    toast.success('Enlace del perfil copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Perfil de @${username}`,
          text: shareText,
          url: shareUrl,
        })
        onClose()
      } catch {}
    } else {
      copyLink()
    }
  }

  const options = [
    { label: 'WhatsApp', icon: MessageCircle, color: 'from-olive-500 to-olive-600', url: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}` },
    { label: 'X (Twitter)', icon: Twitter, color: 'from-gray-700 to-gray-900', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { label: 'Facebook', icon: Facebook, color: 'from-wine-500 to-wine-700', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { label: 'Telegram', icon: Send, color: 'from-wine-400 to-wine-500', url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
    { label: 'Email', icon: Mail, color: 'from-bronze-400 to-bronze-600', url: `mailto:?subject=${encodeURIComponent('Perfil de @' + username + ' en DevPlay')}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}` },
  ]

  return (
    <>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md glass-strong rounded-lg border border-border/50 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-sm">Compartir perfil de @{username}</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Opciones múltiples */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Compartir con...</p>
                <div className="grid grid-cols-3 gap-2">
                  {options.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <a
                        key={opt.label}
                        href={opt.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5 rounded-md glass p-3 transition"
                      >
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white', opt.color)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-[10px] font-medium">{opt.label}</span>
                      </a>
                    )
                  })}
                  {/* Copiar enlace como opción más */}
                  <button onClick={copyLink} className="flex flex-col items-center gap-1.5 rounded-md glass p-3 transition">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg btn-gradient-primary text-white">
                      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    </span>
                    <span className="text-[10px] font-medium">{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Enlace directo */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Enlace del perfil</p>
                <div className="flex items-center gap-2 rounded-md glass p-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-0 bg-transparent text-xs text-muted-foreground outline-none"
                  />
                  <Button size="sm" onClick={copyLink} className="rounded-full gap-1.5 shrink-0">
                    {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Link2 className="h-3.5 w-3.5" /> Copiar</>}
                  </Button>
                </div>
              </div>

              {/* Compartir nativo (móvil) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <Button onClick={nativeShare} className="w-full rounded-sm btn-gradient-primary gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Más opciones del dispositivo...
                </Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </>
  )
}
