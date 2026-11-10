'use client'

import { ChevronDown, Pause, Play } from 'lucide-react'
import type { ChannelSummary } from '@/hooks/use-me'
import { channelArt } from '@/lib/channel-art'
import { cn } from '@/lib/utils'

export function ChannelArt({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const src = channelArt(slug)
  return (
    <span className={cn('relative block shrink-0 overflow-hidden rounded-md bg-secondary', className)}>
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-lg font-black tracking-tighter text-accent">
          {name.replace(/^P(\d)/, 'P$1').slice(0, 2)}
        </span>
      )}
    </span>
  )
}

export function Equalizer({ className }: { className?: string }) {
  return (
    <span className={cn('flex h-3.5 items-end gap-0.5', className)} aria-hidden="true">
      {[0, 180, 360].map((delay) => (
        <span
          key={delay}
          className="w-0.5 origin-bottom animate-eq rounded-full bg-current motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms`, height: '100%' }}
        />
      ))}
    </span>
  )
}

type ActiveInfo = { isLive: boolean; nowLine: string | null }

export function ChannelList({
  channels,
  activeSlug,
  tunedIn,
  active,
  onSelect,
}: {
  channels: ChannelSummary[]
  activeSlug: string
  tunedIn: boolean
  active: ActiveInfo
  onSelect: (slug: string) => void
}) {
  const open = channels.filter((c) => !c.isClosed)
  const closed = channels.filter((c) => c.isClosed)

  return (
    <div className="flex flex-col gap-4">
      {open.length === 0 && (
        <p className="rounded-lg bg-card p-5 text-center text-sm text-muted-foreground">
          Ingen kanaler sender akkurat nå. Kom tilbake snart.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {open.map((c, index) => {
          const isActive = c.slug === activeSlug
          const playing = isActive && tunedIn
          const live = isActive ? active.isLive : c.isLive
          const nowLine = isActive
            ? active.nowLine
            : c.relayName
              ? `Direkte fra ${c.relayName}`
              : c.trackTitle
                ? `${c.trackTitle}${c.trackArtist ? ` – ${c.trackArtist}` : ''}`
                : c.description
          return (
            <li
              key={c.slug}
              className="animate-rise motion-reduce:animate-none"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <button
                type="button"
                onClick={() => onSelect(c.slug)}
                aria-pressed={playing}
                aria-label={`${playing ? 'Stopp' : 'Lytt til'} ${c.name}`}
                className={cn(
                  'group flex min-h-20 w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all duration-300 ease-out active:scale-[0.98]',
                  isActive
                    ? 'border-accent/50 bg-card shadow-lg shadow-background/40'
                    : 'border-transparent bg-card/50 hover:bg-card',
                )}
              >
                <ChannelArt slug={c.slug} name={c.name} className="size-14" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="flex min-w-0 items-baseline gap-1.5 text-lg leading-tight">
                      <span className="font-black tracking-tighter">STATIC</span>
                      <span className={cn('truncate', isActive ? 'text-accent' : 'text-foreground')}>{c.name}</span>
                    </span>
                    {live && (
                      <span className="flex shrink-0 items-center gap-1 rounded-sm bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                        <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                        Direkte
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {playing && <Equalizer className="shrink-0 text-accent" />}
                    <span className="truncate">{nowLine}</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">{c.frequency} FM</span>
                </span>
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                    playing
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground',
                  )}
                >
                  {playing ? (
                    <Pause className="size-5 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {closed.length > 0 && (
        <details className="group rounded-lg bg-card/40">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
            <span>
              Avsluttede kanaler <span className="font-mono tabular-nums">({closed.length})</span>
            </span>
            <ChevronDown className="size-4 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="flex flex-col divide-y px-4 pb-2">
            {closed.map((c) => (
              <li key={c.slug} className="flex min-h-11 items-center justify-between gap-3 text-sm text-muted-foreground">
                <span className="truncate">
                  <span className="font-black tracking-tighter">STATIC</span> {c.name}
                </span>
                <span className="shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px]">Stengt</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
