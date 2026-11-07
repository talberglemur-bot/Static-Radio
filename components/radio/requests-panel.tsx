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
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await sendJson(`/api/channels/${slug}/requests`, 'POST', { body: text })
      setText('')
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
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={`req-${slug}`} className="text-sm font-medium">
            Ønsk deg en låt
          </label>
          <div className="flex gap-2">
            <input
              id={`req-${slug}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={160}
              placeholder="Artist – Låttittel"
              className="h-11 min-w-0 flex-1 rounded-full border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" className="h-11 rounded-full px-5" disabled={sending || !text.trim()}>
              Send
            </Button>
          </div>
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
