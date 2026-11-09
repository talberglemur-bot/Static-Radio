'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { SessionUser } from '@/lib/session'

export function useMe() {
  const { data, isLoading, mutate } = useSWR<SessionUser | null>('/api/me', fetcher)
  const isStaff = data?.role === 'staff' || data?.role === 'admin'
  return { me: data ?? null, isLoading, isStaff, mutate }
}

export type ChannelSummary = {
  id: number
  slug: string
  name: string
  frequency: string
  description: string
  isLive: boolean
  isClosed: boolean
  trackTitle: string | null
  trackArtist: string | null
}

export function useChannels(fallbackData?: ChannelSummary[]) {
  return useSWR<ChannelSummary[]>('/api/channels', fetcher, {
    fallbackData,
    refreshInterval: 8000,
  })
}
