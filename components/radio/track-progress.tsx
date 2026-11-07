'use client'

import { useEffect, useState } from 'react'
import { formatTime } from '@/lib/fetcher'
import type { StationState } from '@/lib/station'

export function useTrackPosition(
  nowPlaying: StationState['nowPlaying'],
  getServerNow: () => number,
) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [])
  if (!nowPlaying) return 0
  const pos = nowPlaying.paused
    ? nowPlaying.positionSec
    : (getServerNow() - nowPlaying.startedAt) / 1000
  return Math.min(Math.max(0, pos), nowPlaying.track.durationSec)
}

export function TrackProgress({
  position,
  duration,
  tone = 'default',
}: {
  position: number
  duration: number
  tone?: 'default' | 'panel'
}) {
  const pct = duration > 0 ? (position / duration) * 100 : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={
          tone === 'panel'
            ? 'h-1 overflow-hidden rounded-full bg-panel-foreground/20'
            : 'h-1 overflow-hidden rounded-full bg-muted'
        }
        role="progressbar"
        aria-label="Fremdrift i låten"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div
        className={
          tone === 'panel'
            ? 'flex justify-between font-mono text-xs tabular-nums text-panel-foreground/60'
            : 'flex justify-between font-mono text-xs tabular-nums text-muted-foreground'
        }
      >
        <span>{formatTime(position)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
