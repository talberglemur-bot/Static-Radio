'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fetcher, sendJson } from '@/lib/fetcher'
import { useMe } from '@/hooks/use-me'
import { cn } from '@/lib/utils'

export type SongRequest = {
  id: number
  userName: string
  body: string
  artist: string | null
  title: string | null
  status: 'pending' | 'queued' | 'played' | 'declined'
  createdAt: string
}

const STATUS_STYLE: Record<SongRequest['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  queued: 'bg-accent text-accent-foreground',
  played: 'bg-foreground text-background',
  declined: 'bg-muted text-muted-foreground line-through',
}

const STATUS_LABEL: Record<SongRequest['status'], string> = {
  pending: 'Venter',
  queued: 'I kø',
  played: 'Spilt',
  declined: 'Avslått',
}

export function useRequests(slug: string) {
  return useSWR<SongRequest[]>(`/api/channels/${slug}/requests`, fetcher, {
    refreshInterval: 5000,
  })
}

export function RequestsPanel({ slug }: { slug: string }) {
  const { me } = useMe()
  const { data: requests = [], mutate } = useRequests(slug)
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!artist.trim() || !title.trim() || sending) return
    setSending(true)
    try {
      await sendJson(`/api/channels/${slug}/requests`, 'POST', { artist, title })
      setArtist('')
      setTitle('')
      toast.success('Ønsket er sendt til studio')
      mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {me ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Ønsk deg en låt</h3>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`req-artist-${slug}`} className="text-xs text-muted-foreground">
              Artist
            </label>
            <input
              id={`req-artist-${slug}`}
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              maxLength={80}
              required
              autoComplete="off"
              placeholder="F.eks. Sigrid"
              className="h-11 rounded-full border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`req-title-${slug}`} className="text-xs text-muted-foreground">
              Låttittel
            </label>
            <input
              id={`req-title-${slug}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
              autoComplete="off"
              placeholder="F.eks. Strangers"
              className="h-11 rounded-full border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button
            type="submit"
            className="h-11 rounded-full px-5"
            disabled={sending || !artist.trim() || !title.trim()}
          >
            Send ønske
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
            Logg på
          </Link>{' '}
          for å ønske deg låter.
        </p>
      )}

      <ul className="flex flex-col divide-y rounded-lg bg-card">
        {requests.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">Ingen ønsker ennå.</li>
        )}
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.body}</p>
              <p className="text-xs text-muted-foreground">fra {r.userName}</p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] uppercase',
                STATUS_STYLE[r.status],
              )}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
