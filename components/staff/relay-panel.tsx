'use client'

import { Radio } from 'lucide-react'
import { NRK_STREAMS } from '@/lib/nrk-streams'
import { cn } from '@/lib/utils'
import { control } from './control'

export function RelayPanel({ slug, activeId }: { slug: string; activeId: string | null }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Radio className="size-4" aria-hidden="true" />
        Videresend NRK-radio
      </h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Send en NRK-kanal direkte fra lyd.nrk.no i stedet for spillelisten. Du kan fortsatt snakke over, pause og kjøre reklame.
      </p>
      <div role="radiogroup" aria-label="Kilde" className="grid grid-cols-2 gap-2">
        {[{ id: null as string | null, name: 'Egen spilleliste' }, ...NRK_STREAMS].map((s) => {
          const on = activeId === s.id
          return (
            <button
              key={s.id ?? 'own'}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => control(slug, { type: 'relay', streamId: s.id })}
              className={cn(
                'min-h-11 rounded-lg border px-3 text-sm font-medium transition-all duration-200 active:scale-[0.98]',
                on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-secondary',
              )}
            >
              {s.name}
            </button>
          )
        })}
      </div>
    </section>
  )
}
