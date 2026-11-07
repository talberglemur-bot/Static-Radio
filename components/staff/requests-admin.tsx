'use client'

import { Check, ListMusic, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useRequests, type SongRequest } from '@/components/radio/requests-panel'
import { sendJson } from '@/lib/fetcher'

export function RequestsAdmin({ slug }: { slug: string }) {
  const { data: requests = [], mutate } = useRequests(slug)
  const pending = requests.filter((r) => r.status === 'pending' || r.status === 'queued')

  async function setStatus(id: number, status: SongRequest['status']) {
    try {
      await sendJson(`/api/channels/${slug}/requests`, 'PATCH', { id, status })
      mutate()
    } catch {
      toast.error('Kunne ikke oppdatere ønsket')
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Låtønsker</h2>
        <span className="font-mono text-xs text-muted-foreground">{pending.length} åpne</span>
      </div>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen åpne ønsker.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {pending.map((r) => (
            <li key={r.id} className="flex items-center gap-1 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-pretty">{r.body}</span>
                <span className="text-xs text-muted-foreground">
                  fra {r.userName}
                  {r.status === 'queued' && ' · i kø'}
                </span>
              </div>
              {r.status === 'pending' ? (
                <Button variant="ghost" size="icon" className="size-11" onClick={() => setStatus(r.id, 'queued')} aria-label="Merk som i kø">
                  <ListMusic className="size-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="size-11" onClick={() => setStatus(r.id, 'played')} aria-label="Merk som spilt">
                  <Check className="size-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-11" onClick={() => setStatus(r.id, 'declined')} aria-label="Avslå ønsket">
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
