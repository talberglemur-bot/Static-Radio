'use client'

import { useState } from 'react'
import { Headphones, Users } from 'lucide-react'
import { useRadioEngine } from '@/hooks/use-radio-engine'
import { SiteHeader } from '@/components/radio/site-header'
import { ChatPanel } from '@/components/radio/chat-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { DeckPanel } from './deck-panel'
import { MicPanel } from './mic-panel'
import { SfxPad } from './sfx-pad'
import { LibraryPanel } from './library-panel'
import { StationSettings } from './station-settings'
import { RequestsAdmin } from './requests-admin'
import { TeamPanel } from './team-panel'
import { AdBreakPanel } from './ad-break-panel'
import { RelayPanel } from './relay-panel'
import { NewChannelForm } from './new-channel-form'
import { MoveListenersPanel } from './move-listeners-panel'

type ChannelOption = { slug: string; name: string; frequency: string }

export function StaffConsole({
  channels: initialChannels,
  isAdmin,
}: {
  channels: ChannelOption[]
  isAdmin: boolean
}) {
  const [channels, setChannels] = useState(initialChannels)
  const [slug, setSlug] = useState(channels[0]?.slug ?? 'main')
  const engine = useRadioEngine(slug, { playVoice: false })
  const { data } = engine

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader variant="staff" />

      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Studiokonsoll
              </span>
              <h1 className="truncate text-lg font-bold tracking-tight">
                {data?.channel.name ?? 'Laster…'}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-mono text-xs">
                <Users className="size-3.5" aria-hidden="true" />
                {data?.listeners ?? 0}
                <span className="sr-only">lyttere</span>
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider',
                  data?.live.isLive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                {data?.live.isLive ? 'På lufta' : 'Mikrofon av'}
              </span>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label="Kanal som styres"
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {channels.map((c) => (
              <button
                key={c.slug}
                type="button"
                role="radio"
                aria-checked={c.slug === slug}
                onClick={() => setSlug(c.slug)}
                className={cn(
                  'flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                  c.slug === slug
                    ? 'border-foreground bg-accent text-accent-foreground'
                    : 'bg-card hover:bg-secondary',
                )}
              >
                <span className="font-mono text-xs opacity-70">{c.frequency}</span>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-4">
        <button
          type="button"
          onClick={engine.tunedIn ? engine.tuneOut : engine.tuneIn}
          className={cn(
            'flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors',
            engine.tunedIn ? 'bg-secondary' : 'bg-card hover:bg-secondary',
          )}
        >
          <Headphones className="size-4" aria-hidden="true" />
          {engine.tunedIn ? 'Lytter på sendingen – trykk for å stoppe' : 'Lytt på sendingen i hodetelefoner'}
        </button>

        <Tabs defaultValue="deck" className="flex flex-col gap-4">
          <TabsList className="grid h-auto w-full grid-cols-4">
            <TabsTrigger value="deck" className="min-h-10">
              Spiller
            </TabsTrigger>
            <TabsTrigger value="mic" className="min-h-10">
              Mikrofon
            </TabsTrigger>
            <TabsTrigger value="library" className="min-h-10">
              Bibliotek
            </TabsTrigger>
            <TabsTrigger value="station" className="min-h-10">
              Kanal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deck" className="flex flex-col gap-4">
            <DeckPanel slug={slug} engine={engine} />
            <AdBreakPanel slug={slug} onBreak={!!data?.adBreak} />
            <RelayPanel slug={slug} activeId={data?.channel.relay?.id ?? null} />
            <MoveListenersPanel
              slug={slug}
              channels={channels}
              listeners={data?.listeners ?? 0}
              move={data?.move ?? null}
              getServerNow={engine.getServerNow}
            />
          </TabsContent>

          <TabsContent value="mic" className="flex flex-col gap-4">
            <MicPanel slug={slug} isLive={!!data?.live.isLive} host={data?.live.host ?? null} />
            <SfxPad slug={slug} engine={engine} />
          </TabsContent>

          <TabsContent value="library" className="flex flex-col gap-4">
            <LibraryPanel slug={slug} />
          </TabsContent>

          <TabsContent value="station" className="flex flex-col gap-4">
            {data && <StationSettings key={slug} slug={slug} channel={data.channel} />}
            <RequestsAdmin slug={slug} channels={channels} />
            <section className="flex h-[28rem] flex-col overflow-hidden rounded-2xl border bg-card">
              <h2 className="border-b px-4 py-3 text-sm font-semibold">Livechat</h2>
              <ChatPanel slug={slug} moderate />
            </section>
            <NewChannelForm
              onCreated={(c) => {
                setChannels((list) => [...list, c].sort((a, b) => Number(a.frequency) - Number(b.frequency)))
                setSlug(c.slug)
              }}
            />
            <TeamPanel isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </main>

      <audio ref={engine.musicRef} preload="auto" crossOrigin="anonymous" className="hidden" />
      <audio ref={engine.voiceRef} preload="auto" crossOrigin="anonymous" className="hidden" />
    </div>
  )
}
