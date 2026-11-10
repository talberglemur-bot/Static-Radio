'use client'

import { Headphones, Mic, Share2 } from 'lucide-react'
import type { RadioEngine } from '@/hooks/use-radio-engine'
import type { Reaction } from '@/lib/sfx-catalog'
import { Visualizer } from './visualizer'
import { TrackProgress, useTrackPosition } from './track-progress'
import { FloaterLayer, ReactionBar, useFloaters } from './reactions'
import { ChannelArt } from './channel-list'

type Floaters = ReturnType<typeof useFloaters>

export function NowPlaying({
  slug,
  engine,
  floaters,
  spawn,
  onShare,
}: {
  slug: string
  engine: RadioEngine
  floaters: Floaters['floaters']
  spawn: (r: Reaction) => void
  onShare: () => void
}) {
  const { data, tunedIn, blocked } = engine
  const np = data?.nowPlaying ?? null
  const position = useTrackPosition(np, engine.getServerNow)
  const channel = data?.channel
  const isLive = !!data?.live.isLive

  const title = np ? np.track.title : channel?.relay ? channel.relay.name : 'Stille på lufta'
  const subtitle = np
    ? np.track.artist
    : channel?.relay
      ? 'Direktesending'
      : 'Ingen låter i rotasjon ennå. Følg med.'

  return (
    <div className="relative flex flex-col gap-5 overflow-hidden rounded-xl bg-card p-4">
      <FloaterLayer floaters={floaters} />

      <div className="flex items-start gap-4">
        <ChannelArt slug={slug} name={channel?.name ?? ''} className="size-20" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{channel?.frequency ?? '—'} FM</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Headphones className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">{data?.listeners ?? 0}</span>
              <span className="sr-only">lyttere</span>
            </span>
          </p>
          <p className="truncate text-xl font-bold text-accent">{channel?.name ?? 'Laster…'}</p>
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {channel?.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onShare}
          className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Del det som spilles"
        >
          <Share2 className="size-5" aria-hidden="true" />
        </button>
      </div>

      {data?.adBreak && (
        <p className="animate-rise rounded-md bg-notice px-3 py-2 text-sm font-semibold text-notice-foreground">
          Reklamepause – sendingen fortsetter straks
        </p>
      )}

      {channel?.relay && !data?.adBreak && (
        <p className="animate-rise rounded-md bg-secondary px-3 py-2 text-sm">
          Sender direkte fra <span className="font-semibold">{channel.relay.name}</span>
        </p>
      )}

      {isLive && (
        <p className="flex animate-rise items-center gap-2 rounded-md bg-primary/15 px-3 py-2 text-sm">
          <Mic className="size-4 text-primary" aria-hidden="true" />
          <span>
            <span className="font-semibold">{data?.live.host}</span> snakker direkte
          </span>
        </p>
      )}

      <Visualizer analyserRef={engine.analyserRef} active={tunedIn} className="h-14 w-full text-dial" />

      <div className="flex flex-col gap-3">
        <div key={np?.track.id ?? title} className="min-w-0 animate-rise motion-reduce:animate-none">
          <p className="truncate text-lg font-semibold">{title}</p>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {np && <TrackProgress position={position} duration={np.track.durationSec} tone="panel" />}
      </div>

      {(blocked || np?.paused) && tunedIn && (
        <p className="text-xs text-muted-foreground">
          {np?.paused ? 'Programlederen har satt musikken på pause.' : 'Trykk spill for å fortsette lyden.'}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">Liker du det du hører?</p>
        <ReactionBar slug={slug} onLocal={spawn} />
      </div>
    </div>
  )
}
