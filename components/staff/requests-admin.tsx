'use client'

import { useState } from 'react'
import { Check, Loader2, Play, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { mutate as globalMutate } from 'swr'
import { Button } from '@/components/ui/button'
import { clearRequests, useRequests, type SongRequest } from '@/components/radio/requests-panel'
import { sendJson } from '@/lib/fetcher'

type ChannelOption = { slug: string; name: string; frequency: string }

export function RequestsAdmin({ slug, channels }: { slug: string; channels: ChannelOption[] }) {
  const { data: requests = [], mutate } = useRequests(slug)
  const pending = requests.filter((r) => r.status === 'pending' || r.status === 'queued')
  const [target, setTarget] = useState(slug)
  const [busyId, setBusyId] = useState<number | null>(null)
  const targetSlug = channels.some((c) => c.slug === target) ? target : slug

  async function setStatus(id: number, status: SongRequest['status']) {
    try {
      await sendJson(`/api/channels/${slug}/requests`, 'PATCH', { id, status })
      mutate()
    } catch {
      toast.error('Kunne ikke oppdatere ønsket')
    }
  }

  async function clearAll() {
    if (!window.confirm('Tøm alle låtønsker på denne kanalen?')) return
    try {
      const res = await clearRequests(slug)
      toast.success(`Fjernet ${res.cleared} ønsker`)
      mutate()
    } catch {
      toast.error('Kunne ikke tømme ønskene')
    }
  }

  async function accept(r: SongRequest) {
    setBusyId(r.id)
    try {
      const res = (await sendJson(`/api/channels/${slug}/requests`, 'PATCH', {
        id: r.id,
        accept: true,
        targetSlug,
      })) as { song: { title: string; artist: string; reused: boolean }; channel: string }
      toast.success(`${res.song.artist} – ${res.song.title} spilles neste på ${res.channel}`)
      mutate()
      globalMutate(['station', targetSlug])
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/tracks'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunne ikke finne låta')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Låtønsker</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{pending.length} åpne</span>
          {requests.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 rounded-full px-3 text-muted-foreground"
              disabled={busyId !== null}
              onClick={clearAll}
            >
              <Trash2 className="size-4" aria-hidden />
              Tøm alle
            </Button>
          )}
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Godkjente ønsker spilles på
        <select
          value={targetSlug}
          onChange={(e) => setTarget(e.target.value)}
          className="h-11 rounded-xl border bg-background px-3 text-base"
        >
          {channels.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.frequency} {c.name}
            </option>
          ))}
        </select>
      </label>

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen åpne ønsker.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {pending.map((r) => (
            <li key={r.id} className="flex items-center gap-1 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-pretty">
                  {r.artist && r.title ? `${r.artist} – ${r.title}` : r.body}
                </span>
                <span className="text-xs text-muted-foreground">
                  fra {r.userName}
                  {r.status === 'queued' && ' · neste i kø'}
                </span>
              </div>
              {r.status === 'pending' ? (
                <Button
                  size="sm"
                  className="h-11 gap-1.5 rounded-full px-4"
                  disabled={busyId !== null}
                  onClick={() => accept(r)}
                  aria-label={`Godta og spill ${r.body}`}
                >
                  {busyId === r.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Play className="size-4" aria-hidden />
                  )}
                  {busyId === r.id ? 'Henter' : 'Godta'}
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="size-11" onClick={() => setStatus(r.id, 'played')} aria-label="Merk som spilt">
                  <Check className="size-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                disabled={busyId === r.id}
                onClick={() => setStatus(r.id, 'declined')}
                aria-label="Avslå ønsket"
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
