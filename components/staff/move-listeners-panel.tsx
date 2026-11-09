'use client'

import { useEffect, useState } from 'react'
import { ArrowRightLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { control } from './control'

type ChannelOption = { slug: string; name: string; frequency: string }

const TIMINGS = [
  { label: 'Nå', sec: 0 },
  { label: 'Om 1 min', sec: 60 },
  { label: 'Om 5 min', sec: 300 },
  { label: 'Om 15 min', sec: 900 },
]

function useCountdown(at: number | null, getNow: () => number) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!at) return
    const tick = () => setLeft(Math.max(0, Math.ceil((at - getNow()) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [at, getNow])
  return left
}

export function MoveListenersPanel({
  slug,
  channels,
  listeners,
  move,
  getServerNow,
}: {
  slug: string
  channels: ChannelOption[]
  listeners: number
  move: { to: string; at: number } | null
  getServerNow: () => number
}) {
  const others = channels.filter((c) => c.slug !== slug)
  const [to, setTo] = useState(others[0]?.slug ?? '')
  const [delay, setDelay] = useState(0)
  const [busy, setBusy] = useState(false)
  const left = useCountdown(move?.at ?? null, getServerNow)
  const target = channels.find((c) => c.slug === (move?.to ?? to))

  useEffect(() => {
    if (!others.some((c) => c.slug === to)) setTo(others[0]?.slug ?? '')
  }, [others, to])

  async function run(action: Parameters<typeof control>[1]) {
    setBusy(true)
    await control(slug, action)
    setBusy(false)
  }

  if (!others.length) return null

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4" aria-labelledby="move-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="move-heading" className="flex items-center gap-2 text-sm font-semibold">
          <ArrowRightLeft className="size-4" aria-hidden />
          Flytt lyttere
        </h2>
        <span className="font-mono text-xs text-muted-foreground">{listeners} lytter nå</span>
      </div>

      {move ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
          <p className="text-sm text-pretty" aria-live="polite">
            {left > 0 ? (
              <>
                Flytter alle til <strong>{target?.name ?? move.to}</strong> om{' '}
                <span className="font-mono tabular-nums">
                  {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
                </span>
              </>
            ) : (
              <>
                Lytterne sendes til <strong>{target?.name ?? move.to}</strong>
              </>
            )}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            disabled={busy}
            onClick={() => run({ type: 'cancelMove' })}
            aria-label="Avbryt flytting"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Til kanal
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 rounded-xl border bg-background px-3 text-base"
            >
              {others.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.frequency} {c.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="pb-1.5 text-sm font-medium">Når</legend>
            <div className="grid grid-cols-4 gap-2">
              {TIMINGS.map((t) => (
                <button
                  key={t.sec}
                  type="button"
                  aria-pressed={delay === t.sec}
                  onClick={() => setDelay(t.sec)}
                  className={cn(
                    'h-11 rounded-xl border text-sm transition-colors',
                    delay === t.sec ? 'border-primary bg-primary text-primary-foreground' : 'bg-background',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Button
            className="h-12 rounded-full"
            disabled={busy || !to}
            onClick={() => run({ type: 'moveListeners', to, delaySec: delay })}
          >
            {delay === 0 ? 'Flytt alle lyttere nå' : 'Planlegg flytting'}
          </Button>
        </>
      )}
    </section>
  )
}
