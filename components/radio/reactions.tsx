'use client'

import { useCallback, useRef, useState } from 'react'
import { Flame, Heart, Zap } from 'lucide-react'
import type { Reaction } from '@/lib/sfx-catalog'
import { cn } from '@/lib/utils'

const ICONS: Record<Reaction, typeof Heart> = { heart: Heart, fire: Flame, zap: Zap }
const LABELS: Record<Reaction, string> = { heart: 'Elsker det', fire: 'Fyr', zap: 'Energi' }

type Floater = { id: number; reaction: Reaction; x: number }

export function useFloaters() {
  const [floaters, setFloaters] = useState<Floater[]>([])
  const seq = useRef(0)
  const spawn = useCallback((reaction: Reaction) => {
    const id = ++seq.current
    setFloaters((f) => [...f.slice(-24), { id, reaction, x: 10 + Math.random() * 80 }])
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2300)
  }, [])
  return { floaters, spawn }
}

export function FloaterLayer({ floaters }: { floaters: Floater[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {floaters.map((f) => {
        const Icon = ICONS[f.reaction]
        return (
          <Icon
            key={f.id}
            className={cn(
              'absolute bottom-6 size-7 animate-float-up',
              f.reaction === 'heart' && 'fill-primary text-primary',
              f.reaction === 'fire' && 'fill-accent text-accent',
              f.reaction === 'zap' && 'fill-dial text-foreground',
            )}
            style={{ left: `${f.x}%` }}
          />
        )
      })}
    </div>
  )
}

export function ReactionBar({ slug, onLocal }: { slug: string; onLocal: (r: Reaction) => void }) {
  const lastSent = useRef(0)

  function react(r: Reaction) {
    onLocal(r)
    const now = Date.now()
    if (now - lastSent.current < 700) return
    lastSent.current = now
    fetch(`/api/channels/${slug}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction: r }),
    }).catch(() => {})
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Send en reaksjon">
      {(Object.keys(ICONS) as Reaction[]).map((r) => {
        const Icon = ICONS[r]
        return (
          <button
            key={r}
            type="button"
            onClick={() => react(r)}
            className="flex size-11 items-center justify-center rounded-full bg-secondary transition-transform active:scale-90"
            aria-label={LABELS[r]}
          >
            <Icon className="size-5" />
          </button>
        )
      })}
    </div>
  )
}
