'use client'

import { useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useTrackPosition } from '@/components/radio/track-progress'
import { formatTime } from '@/lib/fetcher'
import type { RadioEngine } from '@/hooks/use-radio-engine'
import { control } from './control'

const first = (v: number | readonly number[]) => (typeof v === 'number' ? v : v[0])

export function DeckPanel({ slug, engine }: { slug: string; engine: RadioEngine }) {
  const { data } = engine
  const np = data?.nowPlaying ?? null
  const position = useTrackPosition(np, engine.getServerNow)
  const [scrub, setScrub] = useState<number | null>(null)
  const [volume, setVolume] = useState<number | null>(null)

  const shownPos = scrub ?? position
  const musicVolume = volume ?? data?.channel.musicVolume ?? 1

  return (
    <>
      <section className="flex flex-col gap-4 rounded-2xl bg-panel p-4 text-panel-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-dial">
              {np ? (np.paused ? 'Pause' : 'Spilles nå') : 'Stille'}
            </span>
            <p className="truncate text-xl font-bold">{np?.track.title ?? 'Ingenting i spilleren'}</p>
            <p className="truncate text-sm opacity-70">
              {np?.track.artist ?? 'Legg til musikk under Bibliotek, eller slå på Auto-DJ.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Slider
            aria-label="Spol i låten"
            value={[Math.min(shownPos, np?.track.durationSec ?? 0)]}
            max={Math.max(1, np?.track.durationSec ?? 1)}
            step={1}
            disabled={!np}
            onValueChange={(v) => setScrub(first(v))}
            onValueCommitted={async (v) => {
              await control(slug, { type: 'seek', positionSec: first(v) })
              setScrub(null)
            }}
          />
          <div className="flex justify-between font-mono text-xs opacity-70">
            <span>{formatTime(shownPos)}</span>
            <span>{formatTime(np?.track.durationSec ?? 0)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            className="size-12 rounded-full"
            disabled={!np}
            onClick={() => control(slug, { type: 'restart' })}
            aria-label="Start låten på nytt"
          >
            <RotateCcw className="size-5" />
          </Button>
          <Button
            size="icon"
            className="size-16 rounded-full"
            disabled={!np}
            onClick={() => control(slug, { type: np?.paused ? 'resume' : 'pause' })}
            aria-label={np?.paused ? 'Fortsett sendingen' : 'Sett sendingen på pause'}
          >
            {np?.paused ? <Play className="size-7" /> : <Pause className="size-7" />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-12 rounded-full"
            onClick={() => control(slug, { type: 'skip' })}
            aria-label="Hopp til neste låt"
          >
            <SkipForward className="size-5" />
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span>Musikkvolum</span>
            <span className="font-mono opacity-70">{Math.round(musicVolume * 100)}%</span>
          </div>
          <Slider
            aria-label="Musikkvolum for alle lyttere"
            value={[musicVolume]}
            max={1}
            step={0.05}
            onValueChange={(v) => setVolume(first(v))}
            onValueCommitted={async (v) => {
              await control(slug, { type: 'volume', value: first(v) })
              setVolume(null)
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-background/10 px-3 py-2">
          <Label htmlFor="auto-dj" className="flex flex-col items-start gap-0.5">
            <span>Auto-DJ</span>
            <span className="text-xs font-normal opacity-70">
              Velger en tilfeldig låt når køen er tom
            </span>
          </Label>
          <Switch
            id="auto-dj"
            checked={!!data?.channel.autoDj}
            onCheckedChange={(v) => control(slug, { type: 'autoDj', value: v })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Neste i køen</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {data?.upNext.length ?? 0} i kø
          </span>
        </div>
        {!data?.upNext.length ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Køen er tom. Legg låter i kø fra Bibliotek.
          </p>
        ) : (
          <ol className="flex flex-col divide-y">
            {data.upNext.map((t, i) => (
              <li key={t.queueId} className="flex items-center gap-3 py-2">
                <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{t.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t.artist} · {formatTime(t.durationSec)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => control(slug, { type: 'play', trackId: t.id }).then(() =>
                    control(slug, { type: 'dequeue', queueId: t.queueId }),
                  )}
                  aria-label={`Spill ${t.title} nå`}
                >
                  <Play className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => control(slug, { type: 'dequeue', queueId: t.queueId })}
                  aria-label={`Fjern ${t.title} fra køen`}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}
