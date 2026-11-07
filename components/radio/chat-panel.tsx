'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fetcher, sendJson } from '@/lib/fetcher'
import { useMe } from '@/hooks/use-me'
import { cn } from '@/lib/utils'

type Message = {
  id: number
  userName: string
  body: string
  isStaff: boolean
  createdAt: string
}

export function ChatPanel({ slug, moderate = false }: { slug: string; moderate?: boolean }) {
  const { me } = useMe()
  const url = `/api/channels/${slug}/chat`
  const { data: messages = [], mutate } = useSWR<Message[]>(url, fetcher, {
    refreshInterval: 2500,
  })
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  const lastId = messages[messages.length - 1]?.id

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId])

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await sendJson(url, 'POST', { body })
      setText('')
      mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    submit()
  }

  async function remove(id: number) {
    try {
      await sendJson(url, 'DELETE', { id })
      mutate()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ol
        ref={listRef}
        className="flex h-72 flex-col gap-2 overflow-y-auto rounded-lg bg-card p-3"
        aria-live="polite"
        aria-label="Chatmeldinger"
      >
        {messages.length === 0 && (
          <li className="m-auto text-sm text-muted-foreground">Ingen meldinger ennå. Si hei!</li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="group flex items-start gap-2 text-sm leading-relaxed">
            <p className="min-w-0 flex-1 text-pretty break-words">
              <span
                className={cn(
                  'mr-1.5 font-semibold',
                  m.isStaff ? 'text-accent' : 'text-foreground',
                )}
              >
                {m.userName}
                {m.isStaff && (
                  <span className="ml-1 rounded-sm bg-accent/15 px-1 text-[10px] font-bold uppercase text-accent">
                    Vert
                  </span>
                )}
              </span>
              <span className="text-foreground/85">{m.body}</span>
            </p>
            {moderate && (
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label={`Slett melding fra ${m.userName}`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ol>

      {me ? (
        <form onSubmit={submit} className="flex items-center gap-2">
          <label htmlFor={`chat-${slug}`} className="sr-only">
            Melding
          </label>
          <input
            id={`chat-${slug}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={280}
            placeholder="Send en hilsen"
            className="h-11 min-w-0 flex-1 rounded-full border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 rounded-full"
            disabled={sending || !text.trim()}
            aria-label="Send melding"
          >
            <Send className="size-4" />
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
            Logg på
          </Link>{' '}
          for å delta i chatten.
        </p>
      )}
    </div>
  )
}
