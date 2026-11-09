'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Trash2, X } from 'lucide-react'
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

function splitRequest(artist: string, title: string) {
  const a = artist.trim()
  const t = title.trim()
  if (t) return { artist: a, title: t }
  const [first, ...rest] = a.split(/\s*[-–—]\s+|\s+[-–—]\s*/)
  return rest.length ? { artist: first.trim(), title: rest.join(' - ').trim() } : { artist: a, title: '' }
}

export function useRequests(slug: string) {
  const { me } = useMe()
  // Key by user so one account's cached wishes never show up for another in the same tab.
  return useSWR<SongRequest[]>(
    me ? [`/api/channels/${slug}/requests`, me.id] : null,
    ([url]: [string, string]) => fetcher<SongRequest[]>(url),
    { refreshInterval: 5000 },
  )
}

export async function clearRequests(slug: string, id?: number) {
  return sendJson<{ cleared: number }>(`/api/channels/${slug}/requests`, 'DELETE', id ? { id } : {})
}

export function RequestsPanel({ slug }: { slug: string }) {
  const { me, isStaff } = useMe()
  const { data: requests = [], mutate } = useRequests(slug)
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')
  const [sending, setSending] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function remove(id?: number) {
    if (!id && !window.confirm(isStaff ? 'Tøm alle ønsker på kanalen?' : 'Fjerne alle ønskene dine?')) return
    setClearing(true)
    try {
      await clearRequests(slug, id)
      mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setClearing(false)
    }
  }

  const parsed = splitRequest(artist, title)
  const ready = Boolean(parsed.artist && parsed.title)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready || sending) return
    setSending(true)
    try {
      await sendJson(`/api/channels/${slug}/requests`, 'POST', parsed)
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
              autoComplete="off"
              placeholder="F.eks. Strangers"
              className="h-11 rounded-full border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button
            type="submit"
            className="h-11 rounded-full px-5"
            disabled={sending || !ready}
          >
            Send ønske
          </Button>
          <p className="text-xs text-muted-foreground">
            Du kan også skrive «Artist - Låt» i artistfeltet.
          </p>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
            Logg på
          </Link>{' '}
          for å ønske deg låter.
        </p>
      )}

      {me && (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{isStaff ? 'Alle ønsker' : 'Dine ønsker'}</h3>
          {requests.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 rounded-full px-3 text-muted-foreground"
              disabled={clearing}
              onClick={() => remove()}
            >
              <Trash2 className="size-4" aria-hidden />
              Tøm
            </Button>
          )}
        </div>
      )}

      {me && (
        <ul className="flex flex-col divide-y rounded-lg bg-card">
          {requests.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">Ingen ønsker ennå.</li>
          )}
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.body}</p>
                {isStaff && <p className="text-xs text-muted-foreground">fra {r.userName}</p>}
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] uppercase',
                  STATUS_STYLE[r.status],
                )}
              >
                {STATUS_LABEL[r.status]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground"
                disabled={clearing}
                onClick={() => remove(r.id)}
                aria-label={`Fjern ønsket ${r.body}`}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
