'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Info, WifiOff, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRadioEngine } from '@/hooks/use-radio-engine'
import { useChannels, type ChannelSummary } from '@/hooks/use-me'
import { useMediaSession } from '@/hooks/use-media-session'
import { useSleepTimer } from '@/hooks/use-sleep-timer'
import { channelArt } from '@/lib/channel-art'
import { ChatPanel } from './chat-panel'
import { RequestsPanel } from './requests-panel'
import { useFloaters } from './reactions'
import { SiteHeader } from './site-header'
import { ChannelList } from './channel-list'
import { NowPlaying } from './now-playing'
import { MiniPlayer } from './mini-player'

const INTRO_KEY = 'stc-hide-intro'

export function ListenerApp({ initialChannels }: { initialChannels: ChannelSummary[] }) {
  const { data: channels = initialChannels } = useChannels(initialChannels)
  const [slug, setSlug] = useState(
    (initialChannels.find((c) => !c.isClosed) ?? initialChannels[0])?.slug ?? 'main',
  )
  const [showIntro, setShowIntro] = useState(false)
  const { floaters, spawn } = useFloaters()
  const engine = useRadioEngine(slug, { onReaction: spawn })
  const { data, error, tunedIn, volume, setVolume, tuneIn, tuneOut, getServerNow } = engine

  useEffect(() => {
    setShowIntro(localStorage.getItem(INTRO_KEY) !== '1')
  }, [])

  const channelName = data?.channel.name ?? channels.find((c) => c.slug === slug)?.name ?? ''
  const np = data?.nowPlaying ?? null
  const isLive = !!data?.live.isLive
  const openChannels = channels.filter((c) => !c.isClosed)

  const statusLine = isLive
    ? `${data?.live.host ?? 'Programleder'} på lufta`
    : data?.adBreak
      ? 'Reklamepause'
      : data?.channel.relay
        ? `Direkte fra ${data.channel.relay.name}`
        : np
          ? `${np.track.title} – ${np.track.artist}`
          : 'Stille på lufta'

  const move = data?.move ?? null
  const handledMoveRef = useRef<string | null>(null)
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

  // If the channel we're on gets closed, hop to the next open one instead of sitting on dead air.
  useEffect(() => {
    const current = channels.find((c) => c.slug === slug)
    if (!current?.isClosed) return
    const next = channels.find((c) => !c.isClosed)
    if (next) {
      setSlug(next.slug)
      toast(`${current.name} er avsluttet. Byttet til ${next.name}.`)
    } else if (tunedIn) {
      tuneOut()
    }
  }, [channels, slug, tunedIn, tuneOut])

  function selectChannel(next: string) {
    if (channels.find((c) => c.slug === next)?.isClosed) return
    if (next === slug && tunedIn) {
      tuneOut()
      return
    }
    setSlug(next)
    if (!tunedIn) tuneIn()
  }

  const stepChannel = useCallback(
    (dir: 1 | -1) => {
      if (openChannels.length < 2) return
      const i = openChannels.findIndex((c) => c.slug === slug)
      const next = openChannels[(i + dir + openChannels.length) % openChannels.length]
      setSlug(next.slug)
    },
    [openChannels, slug],
  )

  const lastVolumeRef = useRef(0.8)
  const toggleMute = useCallback(() => {
    if (volume > 0) {
      lastVolumeRef.current = volume
      setVolume(0)
    } else {
      setVolume(lastVolumeRef.current || 0.8)
    }
  }, [volume, setVolume])

  const sleep = useSleepTimer(() => {
    tuneOut()
    toast('Sovetimeren slo av radioen. God natt!')
  })

  useMediaSession(
    {
      title: np ? np.track.title : statusLine,
      artist: np ? np.track.artist : `STATIC ${channelName}`,
      album: `STATIC ${channelName}`,
      artwork: channelArt(slug) ?? '/icon-512.png',
    },
    tunedIn,
    { play: tuneIn, pause: tuneOut, next: () => stepChannel(1), previous: () => stepChannel(-1) },
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, button, [contenteditable="true"], [role="slider"]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (tunedIn) tuneOut()
        else tuneIn()
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tunedIn, tuneIn, tuneOut, toggleMute])

  async function share() {
    const text = np
      ? `Jeg hører på «${np.track.title}» av ${np.track.artist} på STATIC ${channelName}`
      : `Hør på STATIC ${channelName} direkte`
    const url = location.origin
    try {
      if (navigator.share) {
        await navigator.share({ title: `STATIC ${channelName}`, text, url })
      } else {
        await navigator.clipboard.writeText(`${text} – ${url}`)
        toast('Lenke kopiert')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast('Kunne ikke dele akkurat nå')
    }
  }

  function dismissIntro() {
    localStorage.setItem(INTRO_KEY, '1')
    setShowIntro(false)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col pb-36">
      <div className="px-4">
        <SiteHeader />
      </div>

      {error && (
        <div
          role="status"
          className="sticky top-2 z-20 mx-4 mb-4 flex animate-rise items-center gap-3 rounded-md bg-destructive px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          Mistet forbindelsen. Prøver igjen…
        </div>
      )}

      <main className="flex flex-col gap-10">
        <section aria-labelledby="direkte-heading" className="flex flex-col gap-6 px-4">
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <h1 id="direkte-heading" className="text-3xl font-bold text-balance">
              Direktestrømmer
            </h1>
            <p className="text-base text-muted-foreground text-pretty">
              {openChannels.length} {openChannels.length === 1 ? 'kanal' : 'kanaler'} på lufta nå
            </p>
          </div>

          {showIntro && (
            <aside className="relative flex animate-rise items-start gap-3 rounded-md bg-notice py-4 pl-4 pr-12 text-notice-foreground">
              <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="text-sm font-semibold leading-relaxed text-pretty">
                Trykk på en kanal for å høre på, og bytt fritt mellom dem. Vil du si hei til studio? Bruk{' '}
                <a href="#prat" className="underline underline-offset-2">
                  livechatten eller ønsk en låt
                </a>
                .
              </p>
              <button
                type="button"
                onClick={dismissIntro}
                className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full transition-colors hover:bg-notice-foreground/10"
                aria-label="Skjul tips"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </aside>
          )}

          <ChannelList
            channels={channels}
            activeSlug={slug}
            tunedIn={tunedIn}
            active={{ isLive, nowLine: statusLine }}
            onSelect={selectChannel}
          />
        </section>

        <section id="na-pa-lufta" aria-labelledby="now-heading" className="flex scroll-mt-4 flex-col gap-4 px-4">
          <h2 id="now-heading" className="text-base font-bold">
            Nå på lufta
          </h2>

          <NowPlaying slug={slug} engine={engine} floaters={floaters} spawn={spawn} onShare={share} />

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
                  <li
                    key={t.queueId}
                    className="flex animate-rise items-center gap-3 p-3 motion-reduce:animate-none"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
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
            Prat med studio <span className="font-normal text-muted-foreground">· {channelName}</span>
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
            <TabsContent value="chat" className="animate-rise motion-reduce:animate-none">
              <ChatPanel slug={slug} />
            </TabsContent>
            <TabsContent value="requests" className="animate-rise motion-reduce:animate-none">
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
        </nav>
      </footer>

      <MiniPlayer slug={slug} engine={engine} statusLine={statusLine} toggleMute={toggleMute} sleep={sleep} />

      <audio ref={engine.musicRef} preload="auto" crossOrigin="anonymous" />
      <audio ref={engine.voiceRef} preload="auto" crossOrigin="anonymous" />
    </div>
  )
}
