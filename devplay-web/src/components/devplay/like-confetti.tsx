'use client'

/**
 * Confeti de likes 🎉
 *
 * Ráfaga de partículas que salen del corazón cuando alguien da like. Se
 * monta en una capa fija (`position: fixed`) y se desmonta sola cuando
 * termina la animación, así que no hay estado que limpiar ni nada que
 * mémorizar: quien lo usa solo llama a `burstFrom(elemento)`.
 *
 * Va en su propio archivo a propósito. Si no gusta, se borra este archivo y
 * la línea que lo llama en `post-card.tsx`: nada más se rompe.
 */

import { useEffect, useState } from 'react'

interface Particle {
  id: number
  x: number
  y: number
  /** Dirección y fuerza del tiro: en píxeles desde el origen. */
  dx: number
  dy: number
  /** Rotación final en grados. */
  rot: number
  size: number
  /** Retardo antes de salir, para que no划过 todo de golpe. */
  delay: number
  /** Símbolo: cuadrado pixelado o corazón. */
  shape: 'pixel' | 'heart'
  color: string
}

const COLORS = ['#D9A441', '#C05B2E', '#E8C56B', '#7EF29A', '#FF6B6B']

let nextId = 0

/** Dispara una ráfaga desde el centro de un elemento del DOM. */
function makeParticles(x: number, y: number, count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    // Ángulo en abanico hacia arriba, entre 200º y 340º (radianes).
    const angle = Math.PI + (Math.random() * 0.5 + 0.75) * Math.PI
    const speed = 60 + Math.random() * 90
    return {
      id: nextId++,
      x,
      y,
      dx: Math.cos(angle) * speed,
      // -Math.abs para que siempre salga hacia arriba, sin caer nunca.
      dy: Math.sin(angle) * speed - 40,
      rot: (Math.random() - 0.5) * 540,
      size: 4 + Math.random() * 4,
      delay: i * 22 + Math.random() * 40,
      shape: Math.random() > 0.72 ? 'heart' : 'pixel',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  })
}

export function LikeConfetti({ on }: { on: { x: number; y: number } | null }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (!on) return
    setParticles(makeParticles(on.x, on.y, 14))

    // Se limpian solas: ninguna animación dura más de 1.4s y todas arrancan
    // como mucho 250ms después. El margen cubre la más lenta.
    const t = setTimeout(() => setParticles([]), 1700)
    return () => clearTimeout(t)
  }, [on])

  if (!on || particles.length === 0) return null

  return (
    <div className="like-confetti" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className={p.shape === 'heart' ? 'like-confetti__heart' : 'like-confetti__pixel'}
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: p.color,
            color: p.color,
            animationDelay: `${p.delay}ms`,
            // Las dos variables son lo que consume la animación en CSS.
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            ['--rot' as string]: `${p.rot}deg`,
          }}
        >
          {p.shape === 'heart' ? '♥' : ''}
        </span>
      ))}
    </div>
  )
}