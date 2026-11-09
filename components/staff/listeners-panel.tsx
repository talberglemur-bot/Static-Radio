'use client'

import useSWR from 'swr'
import { Users } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import type { ActiveListener } from '@/app/api/listeners/route'

export function ListenersPanel() {
  const { data, isLoading } = useSWR<{ listeners: ActiveListener[] }>('/api/listeners', fetcher, {
    refreshInterval: 5000,
  })
  const listeners = data?.listeners ?? []

  return (
    <section aria-labelledby="lyttere-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="lyttere-heading" className="flex items-center gap-2 font-semibold">
          <Users className="size-4" aria-hidden="true" />
          Hvem lytter nå
        </h2>
        <span className="font-mono text-xs text-muted-foreground">{listeners.length} kontoer</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster…</p>
      ) : listeners.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen lytter akkurat nå.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {listeners.map((l) => (
            <li key={l.userId} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{l.name}</span>
                {l.email && (
                  <span className="truncate font-mono text-xs text-muted-foreground">{l.email}</span>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs">
                {l.channelName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
