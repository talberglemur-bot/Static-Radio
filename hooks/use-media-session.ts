'use client'

import { useEffect, useRef } from 'react'

type Meta = { title: string; artist: string; album: string; artwork: string }
type Handlers = { play: () => void; pause: () => void; next?: () => void; previous?: () => void }

/** Lock-screen / notification controls for the installed PWA. */
export function useMediaSession(meta: Meta, playing: boolean, handlers: Handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      artwork: [{ src: new URL(meta.artwork, location.origin).href, sizes: '512x512', type: 'image/png' }],
    })
  }, [meta.title, meta.artist, meta.album, meta.artwork])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    const set = (action: MediaSessionAction, fn: (() => void) | null) => {
      try {
        ms.setActionHandler(action, fn)
      } catch {
        // Some browsers reject actions they don't support.
      }
    }
    set('play', () => handlersRef.current.play())
    set('pause', () => handlersRef.current.pause())
    set('stop', () => handlersRef.current.pause())
    set('nexttrack', () => handlersRef.current.next?.())
    set('previoustrack', () => handlersRef.current.previous?.())
    return () => {
      ;(['play', 'pause', 'stop', 'nexttrack', 'previoustrack'] as const).forEach((a) => set(a, null))
    }
  }, [])
}
