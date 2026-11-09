'use client'

import { mutate } from 'swr'
import { toast } from 'sonner'
import { sendJson } from '@/lib/fetcher'
import type { AdItem } from '@/lib/ad-catalog'

export type ControlAction =
  | { type: 'play'; trackId: number }
  | { type: 'enqueue'; trackId: number }
  | { type: 'dequeue'; queueId: number }
  | { type: 'skip' | 'pause' | 'resume' | 'restart' }
  | { type: 'seek'; positionSec: number }
  | { type: 'volume'; value: number }
  | { type: 'autoDj'; value: boolean }
  | { type: 'relay'; streamId: string | null }
  | { type: 'details'; name?: string; description?: string; ticker?: string }
  | { type: 'sfx'; kind?: string; trackId?: number }
  | { type: 'live'; on: boolean; mode?: 'duck' | 'pause' }
  | { type: 'adBreak'; items: AdItem[] }
  | { type: 'endAdBreak' }
  | { type: 'moveListeners' | 'closeChannel'; to: string; delaySec?: number }
  | { type: 'cancelMove' }

export async function control(slug: string, action: ControlAction) {
  try {
    await sendJson(`/api/channels/${slug}/control`, 'POST', action)
    await mutate(['station', slug])
    return true
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Handlingen feilet')
    return false
  }
}

export type LibraryTrack = {
  id: number
  title: string
  artist: string
  durationSec: number
  kind: 'music' | 'sfx' | 'ad'
  src: string
}
