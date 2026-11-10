'use client'

import { useState } from 'react'
import { Moon, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import type { RadioEngine } from '@/hooks/use-radio-engine'
import { useTrackPosition } from './track-progress'
import { ChannelArt, Equalizer } from './channel-list'
import { cn } from '@/lib/utils'

const SLEEP_OPTIONS = [15, 30, 60, 90]

export function MiniPlayer({
  slug,
  engine,
  statusLine,
  toggleMute,
  sleep,
}: {
  slug: string
  engine: RadioEngine
  statusLine: string
  toggleMute: () => void
  sleep: { remainingMin: number | null; start: (m: number) => void; cancel: () => void }
}) {
  const [panel, setPanel] = useState<'none' | 'volume' | 'sleep'>('none')
  const { data, tunedIn, volume, setVolume, tuneIn, tuneOut } = engine
  const np = data?.nowPlaying ?? null
  const position = useTrackPosition(np, engine.getServerNow)
  const progress = np ? position / Math.max(1, np.track.durationSec) : 0
  const isLive = !!data?.live.isLive
  const name = data?.channel.name ?? ''
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  const toggle = (p: 'volume' | 'sleep') => setPanel((cur) => (cur === p ? 'none' : p))
  const iconBtn =
    'relative flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-secondary aria-expanded:bg-secondary'

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/90 backdrop-blur-xl">
      <div className="h-0.5 w-full bg-secondary" aria-hidden="true">
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          panel === 'none' ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="mx-auto max-w-2xl px-4 pt-3">
            {panel === 'volume' && (
              <div className="flex items-center gap-3">
                <button type="button" onClick={toggleMute} className={iconBtn} aria-label={volume === 0 ? 'Slå på lyd' : 'Demp lyd'}>
                  <VolumeIcon className="size-5" aria-hidden="true" />
                </button>
                <Slider
                  value={[volume * 100]}
                  onValueChange={(v) => setVolume((Array.isArray(v) ? v[0] : (v as number)) / 100)}
                  max={100}
                  step={1}
                  aria-label="Lydstyrke"
                  className="flex-1"
                />
                <span className="w-9 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {Math.round(volume * 100)}
                </span>
              </div>
            )}
            {panel === 'sleep' && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {sleep.remainingMin
                    ? `Radioen slår seg av om ${sleep.remainingMin} min`
                    : 'Slå av radioen automatisk etter'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SLEEP_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        sleep.start(m)
                        setPanel('none')
                      }}
                      className="min-h-11 flex-1 rounded-full bg-secondary px-3 text-sm font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      {m} min
                    </button>
                  ))}
                  {sleep.remainingMin && (
                    <button
                      type="button"
                      onClick={() => {
                        sleep.cancel()
                        setPanel('none')
                      }}
                      className="min-h-11 flex-1 rounded-full border px-3 text-sm font-semibold text-muted-foreground"
                    >
                      Av
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <a href="#na-pa-lufta" className="flex min-w-0 flex-1 items-center gap-3 rounded-md" aria-label="Gå til Nå på lufta">
          <ChannelArt slug={slug} name={name} className="size-12" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2 text-xs">
              {tunedIn ? (
                <Equalizer className="h-3 shrink-0 text-accent" />
              ) : (
                isLive && <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              )}
              <span className="truncate font-semibold text-accent">{name}</span>
            </span>
            <span key={statusLine} className="animate-rise truncate text-sm font-semibold motion-reduce:animate-none">
              {statusLine}
            </span>
          </span>
        </a>
        <button
          type="button"
          onClick={() => toggle('sleep')}
          aria-expanded={panel === 'sleep'}
          aria-label={sleep.remainingMin ? `Sovetimer: ${sleep.remainingMin} min igjen` : 'Sovetimer'}
          className={cn(iconBtn, sleep.remainingMin && 'text-accent')}
        >
          <Moon className="size-5" aria-hidden="true" />
          {sleep.remainingMin && (
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1 font-mono text-[10px] font-bold leading-4 text-accent-foreground tabular-nums">
              {sleep.remainingMin}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggle('volume')}
          aria-expanded={panel === 'volume'}
          aria-label="Lydstyrke"
          className={iconBtn}
        >
          <VolumeIcon className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={tunedIn ? tuneOut : tuneIn}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-transform duration-200 ease-out hover:scale-105 active:scale-90"
          aria-label={tunedIn ? 'Stopp avspilling' : 'Spill direkte'}
        >
          {tunedIn ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
        </button>
      </div>
    </div>
  )
}
