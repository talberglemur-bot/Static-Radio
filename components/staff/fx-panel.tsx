'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { FILTERS, SPEEDS } from '@/lib/fx-catalog'
import { cn } from '@/lib/utils'
import { control } from './control'

export function FxPanel({
  slug,
  speed,
  filter,
  relay,
}: {
  slug: string
  speed: number
  filter: string
  relay: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function send(patch: { speed?: number; filter?: string }) {
    setBusy(true)
    await control(slug, { type: 'fx', ...patch })
    setBusy(false)
  }

  const changed = speed !== 1 || filter !== 'none'

  return (
    <section className="flex flex-col gap-4 rounded-lg bg-card p-4" aria-busy={busy}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold">Effekter</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Endrer lyden for alle som lytter på dine egne låter.
          </p>
        </div>
        {changed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => send({ speed: 1, filter: 'none' })}
            className="flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Nullstill
          </button>
        )}
      </div>

      {relay && (
        <p className="rounded-md bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Effektene er av mens kanalen sender NRK. De slår seg på igjen når dine egne låter spilles.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Hastighet</h3>
        <div role="radiogroup" aria-label="Hastighet" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={speed === s.value}
              disabled={busy}
              onClick={() => send({ speed: s.value })}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition-colors disabled:opacity-60',
                speed === s.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-muted',
              )}
            >
              <span>{s.label}</span>
              <span className="font-mono text-xs font-normal opacity-75">{s.value}×</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Lydfilter</h3>
        <div role="radiogroup" aria-label="Lydfilter" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              disabled={busy}
              onClick={() => send({ filter: f.id })}
              className={cn(
                'flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 text-left transition-colors disabled:opacity-60',
                filter === f.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-muted',
              )}
            >
              <span className="text-sm font-semibold">{f.label}</span>
              <span className="text-xs leading-snug opacity-75">{f.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
