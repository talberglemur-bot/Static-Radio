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
  const nearBottomRef = useRef(true)
  const [unseen, setUnseen] = useState(0)
  const lastId = messages[messages.length - 1]?.id
  const prevLastIdRef = useRef<number | undefined>(undefined)

  // Only follow new messages if the reader is already at the bottom; otherwise offer a jump button.
  useEffect(() => {
    const el = listRef.current
    if (!el || lastId === undefined) return
    const firstLoad = prevLastIdRef.current === undefined
    const added = firstLoad ? 0 : messages.filter((m) => m.id > (prevLastIdRef.current ?? 0)).length
    prevLastIdRef.current = lastId
    if (firstLoad || nearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: firstLoad ? 'auto' : 'smooth' })
    } else if (added > 0) {
      setUnseen((n) => n + added)
    }
  }, [lastId, messages])

  useEffect(() => {
    prevLastIdRef.current = undefined
    nearBottomRef.current = true
    setUnseen(0)
  }, [slug])

  function onScroll() {
    const el = listRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    if (nearBottomRef.current) setUnseen(0)
  }

  function jumpToLatest() {
    const el = listRef.current
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setUnseen(0)
  }

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
      <div className="relative">
      <ol
        ref={listRef}
        onScroll={onScroll}
        className="flex h-80 flex-col gap-1 overflow-y-auto overscroll-contain rounded-lg bg-card p-2"
        aria-live="polite"
        aria-label="Chatmeldinger"
      >
        {messages.length === 0 && (
          <li className="m-auto text-sm text-muted-foreground">Ingen meldinger ennå. Si hei!</li>
        )}
        {messages.map((m) => {
          const mine = !!me && m.userName === me.name
          return (
          <li
            key={m.id}
            className={cn(
              'group flex animate-rise items-start gap-2 rounded-md px-2 py-1.5 text-sm leading-relaxed [animation-duration:0.35s] motion-reduce:animate-none',
              mine && 'bg-secondary/60',
            )}
          >
            <p className="min-w-0 flex-1 text-pretty break-words">
              <span
                className={cn(
                  'mr-1.5 font-semibold',
                  m.isStaff ? 'text-accent' : mine ? 'text-primary' : 'text-foreground',
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
            <time
              dateTime={m.createdAt}
              className="shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums"
            >
              {new Date(m.createdAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
            </time>
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
          )
        })}
      </ol>
      {unseen > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 min-h-9 -translate-x-1/2 animate-rise rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-lg"
        >
          {unseen} {unseen === 1 ? 'ny melding' : 'nye meldinger'}
        </button>
      )}
      </div>

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
            className="h-11 min-w-0 flex-1 rounded-full border bg-card px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
          />
          {text.length > 220 && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {280 - text.length}
            </span>
          )}
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
