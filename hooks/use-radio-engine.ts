'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import type { StationState } from '@/lib/station'
import { playSynthSfx } from '@/lib/sfx-synth'
import type { BuiltInSfxKind, Reaction } from '@/lib/sfx-catalog'

const DRIFT_TOLERANCE_SEC = 1.5
const DUCKED = 0.22

function getListenerId() {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem('radio-listener-id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('radio-listener-id', id)
  }
  return id
}

function norwegianVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? []
  return (
    voices.find((v) => /^(nb|no|nn)(-|_|$)/i.test(v.lang)) ??
    voices.find((v) => /norsk|norwegian/i.test(v.name)) ??
    null
  )
}

function speak(text: string, volume: number) {
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'nb-NO'
    const voice = norwegianVoice()
    if (voice) u.voice = voice
    u.rate = 1.02
    u.volume = Math.min(1, volume + 0.1)
    u.onend = () => resolve()
    u.onerror = () => resolve()
    synth.speak(u)
  })
}

/** iOS only lets speech start from a tap; speaking a silent line during "Lytt" unlocks it. */
function primeSpeech() {
  const synth = window.speechSynthesis
  if (!synth) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  synth.speak(u)
}

type Options = {
  /** Staff monitoring their own channel should not hear their delayed voice. */
  playVoice?: boolean
  onReaction?: (r: Reaction) => void
}

export function useRadioEngine(slug: string, { playVoice = true, onReaction }: Options = {}) {
  const [tunedIn, setTunedIn] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [blocked, setBlocked] = useState(false)

  const musicRef = useRef<HTMLAudioElement | null>(null)
  const voiceRef = useRef<HTMLAudioElement | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const sfxBusRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sinceRef = useRef({ sfx: -1, chunk: -1, slug })
  const offsetRef = useRef(0)
  const voiceQueue = useRef<string[]>([])
  const voicePlaying = useRef(false)
  const onReactionRef = useRef(onReaction)
  onReactionRef.current = onReaction
  const adDoneRef = useRef(new Set<string>())

  const stopAds = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    const el = musicRef.current
    if (el?.dataset.ad) {
      delete el.dataset.ad
      el.pause()
      el.removeAttribute('src')
    }
  }, [])

  if (sinceRef.current.slug !== slug) sinceRef.current = { sfx: -1, chunk: -1, slug }

  const { data, error } = useSWR<StationState>(
    ['station', slug],
    async () => {
      const since = sinceRef.current
      const qs = new URLSearchParams({
        listener: tunedIn ? getListenerId() : '',
        sinceSfx: String(since.sfx),
        sinceChunk: String(since.chunk),
      })
      const sentAt = Date.now()
      const res = await fetch(`/api/channels/${slug}/state?${qs}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Kanalen er utilgjengelig')
      const json = (await res.json()) as StationState
      const receivedAt = Date.now()
      offsetRef.current = json.serverNow - (sentAt + receivedAt) / 2
      return json
    },
    { refreshInterval: 2000, revalidateOnFocus: true, dedupingInterval: 500 },
  )

  const ensureAudioGraph = useCallback(() => {
    if (ctxRef.current) return ctxRef.current
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.8
    analyser.connect(ctx.destination)
    const sfxBus = ctx.createGain()
    sfxBus.connect(analyser)
    if (musicRef.current) ctx.createMediaElementSource(musicRef.current).connect(analyser)
    if (voiceRef.current) ctx.createMediaElementSource(voiceRef.current).connect(analyser)
    ctxRef.current = ctx
    sfxBusRef.current = sfxBus
    analyserRef.current = analyser
    return ctx
  }, [])

  const playNextVoice = useCallback(() => {
    const el = voiceRef.current
    const next = voiceQueue.current.shift()
    if (!el || !next) {
      voicePlaying.current = false
      return
    }
    voicePlaying.current = true
    el.src = next
    el.play().catch(() => {
      voicePlaying.current = false
    })
  }, [])

  const playSfx = useCallback(
    (kind: string, src: string | null) => {
      const ctx = ctxRef.current
      const bus = sfxBusRef.current
      if (!ctx || !bus) return
      if (kind.startsWith('react:')) {
        onReactionRef.current?.(kind.slice(6) as Reaction)
        return
      }
      // Ad breaks are driven by the shared timeline in the station state.
      if (kind === 'ad-stop' || kind.startsWith('ad:')) return
      if (src) {
        const a = new Audio(src)
        a.volume = Math.min(1, volume + 0.1)
        a.play().catch(() => {})
        return
      }
      playSynthSfx(ctx, bus, kind as BuiltInSfxKind)
    },
    [volume],
  )

  // Sync the music element to the shared station clock.
  useEffect(() => {
    const el = musicRef.current
    if (!el || !data) return
    const since = sinceRef.current

    // First response on a channel: start the event cursors at "now".
    if (since.sfx < 0) since.sfx = data.latestSfxId
    else if (data.sfx.length) {
      since.sfx = data.sfx[data.sfx.length - 1].id
      if (tunedIn) data.sfx.forEach((e) => playSfx(e.kind, e.src))
    }
    if (since.chunk < 0) since.chunk = data.latestChunkId
    else if (data.chunks.length) {
      since.chunk = data.chunks[data.chunks.length - 1].id
      if (tunedIn && playVoice) {
        voiceQueue.current.push(...data.chunks.map((c) => c.src))
        if (!voicePlaying.current) playNextVoice()
      }
    }

    const duck = data.live.isLive && data.live.mode === 'duck' ? DUCKED : 1
    el.volume = Math.min(1, Math.max(0, volume * data.channel.musicVolume * duck))
    if (voiceRef.current) voiceRef.current.volume = Math.min(1, volume + 0.15)
    if (sfxBusRef.current) sfxBusRef.current.gain.value = volume

    const ad = data.adBreak
    if (ad) {
      if (!tunedIn) {
        if (!el.paused) el.pause()
        return
      }
      const elapsed = (Date.now() + offsetRef.current - ad.startedAt) / 1000
      const done = adDoneRef.current
      const jingleKey = `${ad.id}-jingle`
      if (elapsed < 1.5 && !done.has(jingleKey) && ctxRef.current && sfxBusRef.current) {
        done.add(jingleKey)
        playSynthSfx(ctxRef.current, sfxBusRef.current, 'chime')
      }
      const idx = ad.slots.findIndex((s) => elapsed >= s.startSec && elapsed < s.startSec + s.durationSec)
      const slot = idx >= 0 ? ad.slots[idx] : null
      const key = `${ad.id}-${idx}`
      delete el.dataset.relay
      delete el.dataset.trackId

      if (!slot || slot.type === 'tts') {
        if (el.dataset.ad) {
          delete el.dataset.ad
          el.removeAttribute('src')
        }
        if (!el.paused) el.pause()
        // Speech can't be seeked, so only start a spot if most of it is still ahead.
        if (slot?.script && !done.has(key) && elapsed - slot.startSec < slot.durationSec * 0.4) {
          done.add(key)
          window.speechSynthesis?.cancel()
          speak(slot.script, volume)
        }
        return
      }

      el.volume = Math.min(1, volume)
      const target = Math.max(0, elapsed - slot.startSec)
      if (el.dataset.ad !== key) {
        window.speechSynthesis?.cancel()
        el.dataset.ad = key
        el.src = new URL(slot.src!, window.location.origin).href
        el.addEventListener(
          'loadedmetadata',
          () => {
            const now = (Date.now() + offsetRef.current - ad.startedAt) / 1000 - slot.startSec
            el.currentTime = Math.max(0, Math.min(now, slot.durationSec - 0.25))
            el.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
          },
          { once: true },
        )
        el.load()
        return
      }
      if (el.readyState >= 1 && Math.abs(el.currentTime - target) > DRIFT_TOLERANCE_SEC) {
        el.currentTime = Math.min(target, slot.durationSec - 0.25)
      }
      if (el.paused && !el.ended) el.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
      return
    }
    if (el.dataset.ad) stopAds()

    const relay = data.channel.relay
    if (relay) {
      const holdRelay = !tunedIn || data.channel.paused
      if (holdRelay) {
        if (!el.paused) el.pause()
        return
      }
      if (el.dataset.relay !== relay.id) {
        el.crossOrigin = 'anonymous'
        el.dataset.relay = relay.id
        delete el.dataset.trackId
        el.src = relay.src
        el.load()
      }
      if (el.paused) el.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
      return
    }
    if (el.dataset.relay) {
      delete el.dataset.relay
      el.removeAttribute('src')
    }

    const np = data.nowPlaying
    if (!tunedIn || !np) {
      if (!el.paused) el.pause()
      if (!np) el.removeAttribute('src')
      return
    }

    const expected = np.paused
      ? np.positionSec
      : (Date.now() + offsetRef.current - np.startedAt) / 1000

    const wantSrc = new URL(np.track.src, window.location.origin).href
    if (el.src !== wantSrc) {
      el.src = wantSrc
      el.dataset.trackId = String(np.track.id)
      const seekOnLoad = () => {
        const target = np.paused
          ? np.positionSec
          : (Date.now() + offsetRef.current - np.startedAt) / 1000
        el.currentTime = Math.max(0, Math.min(target, np.track.durationSec - 0.25))
        if (!np.paused) el.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
      }
      el.addEventListener('loadedmetadata', seekOnLoad, { once: true })
      el.load()
      return
    }

    if (np.paused) {
      if (!el.paused) el.pause()
      if (Math.abs(el.currentTime - expected) > 0.5) el.currentTime = expected
      return
    }
    if (el.readyState >= 1 && Math.abs(el.currentTime - expected) > DRIFT_TOLERANCE_SEC) {
      el.currentTime = Math.max(0, Math.min(expected, np.track.durationSec - 0.25))
    }
    if (el.paused) el.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
  }, [data, tunedIn, volume, playVoice, playSfx, playNextVoice, stopAds])

  useEffect(() => {
    const el = voiceRef.current
    if (!el) return
    const onEnd = () => playNextVoice()
    el.addEventListener('ended', onEnd)
    el.addEventListener('error', onEnd)
    return () => {
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('error', onEnd)
    }
  }, [playNextVoice])

  const tuneIn = useCallback(async () => {
    const ctx = ensureAudioGraph()
    await ctx.resume().catch(() => {})
    primeSpeech()
    setTunedIn(true)
    setBlocked(false)
    musicRef.current?.play().catch(() => {})
  }, [ensureAudioGraph])

  const tuneOut = useCallback(() => {
    setTunedIn(false)
    musicRef.current?.pause()
    voiceRef.current?.pause()
    voiceQueue.current = []
    voicePlaying.current = false
    adDoneRef.current.clear()
    stopAds()
  }, [stopAds])

  /** Plays a sound locally only (staff preview). */
  const previewSfx = useCallback(
    async (kind: string, src: string | null) => {
      const ctx = ensureAudioGraph()
      await ctx.resume().catch(() => {})
      playSfx(kind, src)
    },
    [ensureAudioGraph, playSfx],
  )

  const getServerNow = useCallback(() => Date.now() + offsetRef.current, [])

  return {
    data,
    error,
    tunedIn,
    blocked,
    volume,
    setVolume,
    tuneIn,
    tuneOut,
    previewSfx,
    getServerNow,
    analyserRef,
    musicRef,
    voiceRef,
  }
}

export type RadioEngine = ReturnType<typeof useRadioEngine>
