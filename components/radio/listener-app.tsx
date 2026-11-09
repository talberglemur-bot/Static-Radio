'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowUpRight, Headphones, Info, Mic, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRadioEngine } from '@/hooks/use-radio-engine'
import { useChannels, type ChannelSummary } from '@/hooks/use-me'
import { channelArt } from '@/lib/channel-art'
import { Visualizer } from './visualizer'
import { TrackProgress, useTrackPosition } from './track-progress'
import { ChatPanel } from './chat-panel'
import { RequestsPanel } from './requests-panel'
import { FloaterLayer, ReactionBar, useFloaters } from './reactions'
import { SiteHeader } from './site-header'
import { cn } from '@/lib/utils'

const CHANNEL_COLORS = ['text-accent', 'text-primary', 'text-notice']

function ChannelArt({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const src = channelArt(slug)
  return (
    <span className={cn('relative block shrink-0 overflow-hidden rounded-sm bg-secondary', className)}>
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-xl font-black text-accent">
          {name.slice(0, 1)}
        </span>
      )}
    </span>
  )
}

export function ListenerApp({ initialChannels }: { initialChannels: ChannelSummary[] }) {
  const { data: channels = initialChannels } = useChannels(initialChannels)
  const [slug, setSlug] = useState(
    (initialChannels.find((c) => !c.isClosed) ?? initialChannels[0])?.slug ?? 'main',
  )
  const [showVolume, setShowVolume] = useState(false)
  const { floaters, spawn } = useFloaters()
  const engine = useRadioEngine(slug, { onReaction: spawn })
  const { data, tunedIn, blocked, volume, setVolume, tuneIn, tuneOut } = engine
  const position = useTrackPosition(data?.nowPlaying ?? null, engine.getServerNow)

  const channel = data?.channel ?? channels.find((c) => c.slug === slug)
  const np = data?.nowPlaying
  const isLive = !!data?.live.isLive
  const progress = np ? position / Math.max(1, np.track.durationSec) : 0

  const move = data?.move ?? null
  const handledMoveRef = useRef<string | null>(null)
  const { getServerNow } = engine
  useEffect(() => {
    if (!move || move.to === slug) return
    const key = `${slug}:${move.to}:${move.at}`
    if (handledMoveRef.current === key) return
    const follow = () => {
      handledMoveRef.current = key
      const target = channels.find((c) => c.slug === move.to)
      setSlug(move.to)
      toast(`Du ble flyttet til ${target?.name ?? move.to}`)
    }
    const wait = move.at - getServerNow()
    if (wait <= 0) {
      follow()
      return
    }
    const id = setTimeout(follow, wait)
    return () => clearTimeout(id)
  }, [move, slug, channels, getServerNow])

  function selectChannel(next: string) {
    if (channels.find((c) => c.slug === next)?.isClosed) return
    if (next === slug && tunedIn) {
      tuneOut()
      return
    }
    setSlug(next)
    if (!tunedIn) tuneIn()
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col pb-32">
      <div className="px-4">
        <SiteHeader />
      </div>

      <main className="flex flex-col gap-10">
        <section aria-labelledby="direkte-heading" className="flex flex-col gap-8 px-4">
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <h1 id="direkte-heading" className="text-3xl font-bold text-balance">
              Direktestrømmer
            </h1>
            <p className="text-base text-pretty">Følgende kanaler er tilgjengelig fra Static Radio</p>
          </div>

          <aside className="flex items-center gap-4 rounded-md bg-notice px-5 py-4 text-notice-foreground">
            <Info className="size-6 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-3 text-sm font-semibold leading-relaxed">
              <p className="text-pretty">
                Kanalene sendes direkte og er laget for privat lytting. Trykk på en kanal for å høre på, og bytt
                fritt mellom dem.
              </p>
              <p className="text-pretty">
                Vil du si hei til studio? Bruk{' '}
                <a href="#prat" className="underline underline-offset-2">
                  livechatten eller ønsk en låt.
                </a>
              </p>
            </div>
          </aside>

          <div className="flex flex-col gap-12">
            {channels.map((c, index) => {
              const active = c.slug === slug
              const playing = active && tunedIn
              const live = active ? isLive : c.isLive
              const nowLine = active
                ? isLive
                  ? `${data?.live.host ?? 'Programleder'} er på lufta`
                  : data?.channel.relay
                    ? `Direkte fra ${data.channel.relay.name}`
                    : (np?.track.title ?? c.description)
                : c.relayName
                  ? `Direkte fra ${c.relayName}`
                  : (c.trackTitle ?? c.description)
              const nameColor = CHANNEL_COLORS[index % CHANNEL_COLORS.length]
              const row =
                'flex min-h-11 w-full items-center justify-between gap-4 border-b border-border py-2.5 text-left text-lg text-accent transition-all duration-200 ease-out hover:pl-1 hover:text-foreground active:opacity-70'
              if (c.isClosed) {
                return (
                  <section
                    key={c.slug}
                    aria-labelledby={`kanal-${c.slug}`}
                    aria-disabled="true"
                    className="flex animate-rise flex-col opacity-50 motion-reduce:animate-none"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <h2 id={`kanal-${c.slug}`} className="flex items-center gap-3 pb-2">
                      <span className="flex items-baseline gap-2 text-3xl leading-none">
                        <span className="font-black tracking-tighter">STATIC</span>
                        <span className="font-normal text-muted-foreground line-through">{c.name}</span>
                      </span>
                      <span className="rounded-sm border border-border px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        Stengt
                      </span>
                    </h2>
                    <p className="flex min-h-11 items-center border-b border-border py-2.5 text-lg text-muted-foreground">
                      Denne kanalen er avsluttet
                    </p>
                  </section>
                )
              }
              return (
                <section
                  key={c.slug}
                  aria-labelledby={`kanal-${c.slug}`}
                  className="flex animate-rise flex-col motion-reduce:animate-none"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <h2 id={`kanal-${c.slug}`} className="flex items-center gap-3 pb-2">
                    <span className="flex items-baseline gap-2 text-3xl leading-none">
                      <span className="font-black tracking-tighter">STATIC</span>
                      <span className={cn('font-normal', nameColor)}>{c.name}</span>
                    </span>
                    {live && (
                      <span className="rounded-sm border border-accent/40 px-1.5 py-0.5 text-xs font-semibold text-accent">
                        Direkte
                      </span>
                    )}
                  </h2>
                  <ul className="flex flex-col">
                    <li>
                      <button
                        type="button"
                        onClick={() => selectChannel(c.slug)}
                        aria-pressed={playing}
                        className={row}
                      >
                        <span>{playing ? 'Stopp avspilling' : 'Lytt direkte'}</span>
                        {playing ? (
                          <Pause className="size-6 shrink-0 text-foreground" aria-hidden="true" />
                        ) : (
                          <Play className="size-6 shrink-0 text-foreground" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                    <li>
                      <a href="#na-pa-lufta" onClick={() => setSlug(c.slug)} className={row}>
                        <span className="min-w-0 truncate">Nå: {nowLine}</span>
                        <ArrowUpRight className="size-6 shrink-0 text-foreground" aria-hidden="true" />
                      </a>
                    </li>
                    <li>
                      <a href="#prat" onClick={() => setSlug(c.slug)} className={row}>
                        <span>Prat med studio</span>
                        <ArrowUpRight className="size-6 shrink-0 text-foreground" aria-hidden="true" />
                      </a>
                    </li>
                  </ul>
                </section>
              )
            })}
          </div>
        </section>

        <section
          id="na-pa-lufta"
          aria-labelledby="now-heading"
          className="flex scroll-mt-4 flex-col gap-4 px-4"
        >
          <h2 id="now-heading" className="text-base font-bold">
            Nå på lufta
          </h2>

          <div className="relative flex flex-col gap-5 overflow-hidden rounded-lg bg-card p-4">
            <FloaterLayer floaters={floaters} />

            <div className="flex items-start gap-4">
              <ChannelArt slug={slug} name={channel?.name ?? ''} className="size-24" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono tabular-nums">{channel?.frequency} FM</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    <Headphones className="size-3.5" aria-hidden="true" />
                    {data?.listeners ?? 0}
                    <span className="sr-only">lyttere</span>
                  </span>
                </p>
                <p className="truncate text-xl font-bold text-accent">{channel?.name}</p>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  {channel?.description}
                </p>
              </div>
            </div>

            {data?.adBreak && (
              <p className="animate-rise rounded-md bg-notice px-3 py-2 text-sm font-semibold text-notice-foreground">
                Reklamepause – sendingen fortsetter straks
              </p>
            )}

            {data?.channel.relay && !data?.adBreak && (
              <p className="animate-rise rounded-md bg-secondary px-3 py-2 text-sm">
                Sender direkte fra <span className="font-semibold">{data.channel.relay.name}</span>
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
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">
                  {np ? np.track.title : data?.channel.relay ? data.channel.relay.name : 'Stille på lufta'}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {np
                    ? np.track.artist
                    : data?.channel.relay
                      ? 'Direktesending'
                      : 'Ingen låter i rotasjon ennå. Følg med.'}
                </p>
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

          {data?.channel.ticker && (
            <div className="overflow-hidden rounded-md bg-secondary py-2.5" aria-label="Melding fra kanalen">
              <div className="flex w-max animate-marquee gap-12 whitespace-nowrap pl-4 text-sm motion-reduce:animate-none">
                <span>{data.channel.ticker}</span>
                <span aria-hidden="true">{data.channel.ticker}</span>
                <span aria-hidden="true">{data.channel.ticker}</span>
                <span aria-hidden="true">{data.channel.ticker}</span>
              </div>
            </div>
          )}

          {data && data.upNext.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">Neste på spillelista</h3>
              <ol className="flex flex-col divide-y rounded-lg bg-card">
                {data.upNext.slice(0, 5).map((t, i) => (
                  <li key={t.queueId} className="flex items-center gap-3 p-3">
                    <span className="w-5 font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.artist}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section id="prat" aria-labelledby="prat-heading" className="flex scroll-mt-4 flex-col gap-4 px-4">
          <h2 id="prat-heading" className="text-base font-bold">
            Prat med studio
          </h2>
          <Tabs defaultValue="chat" className="gap-3">
            <TabsList className="h-11 w-full">
              <TabsTrigger value="chat" className="min-h-9">
                Livechat
              </TabsTrigger>
              <TabsTrigger value="requests" className="min-h-9">
                Ønsk en låt
              </TabsTrigger>
            </TabsList>
            <TabsContent value="chat">
              <ChatPanel slug={slug} />
            </TabsContent>
            <TabsContent value="requests">
              <RequestsPanel slug={slug} />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <footer className="mx-4 mt-14 flex flex-col items-center gap-3 border-t pt-8 text-center text-sm text-muted-foreground">
        <p>Opphavsrett Static Radio © {new Date().getFullYear()}</p>
        <p>
          Ansvarlig redaktør: <span className="font-semibold text-foreground">Jonas Voll</span>
        </p>
        <nav aria-label="Bunnmeny" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-accent">
          <a href="#prat" className="flex min-h-11 items-center underline-offset-2 hover:underline">
            Kontakt
          </a>
          <a href="#na-pa-lufta" className="flex min-h-11 items-center underline-offset-2 hover:underline">
            Nå på lufta
          </a>
          <a href="/sign-in" className="flex min-h-11 items-center underline-offset-2 hover:underline">
            Logg på
          </a>
        </nav>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="h-0.5 w-full bg-secondary" aria-hidden="true">
          <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
        {showVolume && (
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-3">
            <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Slider
              value={[volume * 100]}
              onValueChange={(v) => setVolume((Array.isArray(v) ? v[0] : (v as number)) / 100)}
              max={100}
              step={1}
              aria-label="Lydstyrke"
              className="flex-1"
            />
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <ChannelArt slug={slug} name={channel?.name ?? ''} className="size-12" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2 text-xs">
              {isLive && <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />}
              <span className="truncate font-semibold text-accent">{channel?.name}</span>
            </span>
            <span className="truncate text-sm font-semibold">
              {isLive
                ? `${data?.live.host} på lufta`
                : data?.adBreak
                  ? 'Reklamepause'
                  : data?.channel.relay
                    ? `Direkte fra ${data.channel.relay.name}`
                    : (np?.track.title ?? 'Stille på lufta')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowVolume((v) => !v)}
            aria-expanded={showVolume}
            aria-label="Lydstyrke"
            className="flex size-11 items-center justify-center rounded-full hover:bg-secondary"
          >
            {volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <button
            type="button"
            onClick={tunedIn ? tuneOut : tuneIn}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-200 ease-out hover:scale-105 active:scale-95"
            aria-label={tunedIn ? 'Stopp avspilling' : 'Spill direkte'}
          >
            {tunedIn ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
          </button>
        </div>
      </div>

      <audio ref={engine.musicRef} preload="auto" crossOrigin="anonymous" />
      <audio ref={engine.voiceRef} preload="auto" crossOrigin="anonymous" />
    </div>
  )
}
