'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { control } from './control'

const SEGMENT_MS = 3000
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

export function MicPanel({
  slug,
  isLive,
  host,
}: {
  slug: string
  isLive: boolean
  host: string | null
}) {
  const [onAir, setOnAir] = useState(false)
  const [mode, setMode] = useState<'duck' | 'pause'>('duck')
  const [level, setLevel] = useState(0)
  const [uploads, setUploads] = useState(0)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const activeRef = useRef(false)
  const slugRef = useRef(slug)
  const rafRef = useRef(0)
  const ctxRef = useRef<AudioContext | null>(null)

  async function uploadSegment(blob: Blob, forSlug: string) {
    if (blob.size < 200) return
    const form = new FormData()
    form.append('chunk', blob, 'chunk')
    const res = await fetch(`/api/channels/${forSlug}/live`, { method: 'POST', body: form })
    if (res.ok) setUploads((n) => n + 1)
  }

  function recordSegment(stream: MediaStream, mime: string) {
    if (!activeRef.current) return
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const parts: BlobPart[] = []
    const forSlug = slugRef.current
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
    rec.onstop = () => {
      uploadSegment(new Blob(parts, { type: rec.mimeType || mime || 'audio/webm' }), forSlug)
      recordSegment(stream, mime)
    }
    rec.start()
    recorderRef.current = rec
    setTimeout(() => rec.state === 'recording' && rec.stop(), SEGMENT_MS)
  }

  function meter(stream: MediaStream) {
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(buf)
      let peak = 0
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
      setLevel(Math.min(1, peak / 90))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  async function goLive() {
    const mime = pickMime()
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Denne nettleseren kan ikke ta opp lyd.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      activeRef.current = true
      slugRef.current = slug
      setOnAir(true)
      setUploads(0)
      meter(stream)
      await control(slug, { type: 'live', on: true, mode })
      recordSegment(stream, mime)
    } catch {
      toast.error('Mikrofontilgang ble blokkert. Tillat den i nettleserinnstillingene.')
    }
  }

  function stopLive(forSlug = slugRef.current) {
    activeRef.current = false
    recorderRef.current?.state === 'recording' && recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    cancelAnimationFrame(rafRef.current)
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    setLevel(0)
    setOnAir(false)
    control(forSlug, { type: 'live', on: false })
  }

  // Switching channels while on air ends the broadcast on the old channel.
  useEffect(() => {
    if (activeRef.current && slugRef.current !== slug) stopLive(slugRef.current)
    slugRef.current = slug
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(
    () => () => {
      if (activeRef.current) stopLive()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const someoneElse = isLive && !onAir

  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl bg-panel p-5 text-panel-foreground">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-sm font-semibold">Direktemikrofon</h2>
        <span className="font-mono text-xs opacity-70">
          {onAir ? `${uploads} segmenter sendt` : someoneElse ? `${host ?? 'En programleder'} er direkte` : 'Klar'}
        </span>
      </div>

      <div role="radiogroup" aria-label="Hvordan musikken skal oppføre seg" className="grid w-full grid-cols-2 gap-2">
        {(
          [
            { value: 'duck', label: 'Snakk over', hint: 'Musikken dempes' },
            { value: 'pause', label: 'Pause programmet', hint: 'Musikken stopper' },
          ] as const
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            disabled={onAir}
            onClick={() => setMode(o.value)}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 text-sm font-semibold transition-all duration-200 disabled:opacity-50',
              mode === o.value
                ? 'border-dial bg-dial text-panel'
                : 'border-background/20 hover:bg-background/10',
            )}
          >
            {o.label}
            <span className="text-xs font-normal opacity-75">{o.hint}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => (onAir ? stopLive() : goLive())}
        aria-pressed={onAir}
        className={cn(
          'relative flex size-36 flex-col items-center justify-center gap-2 rounded-full border-4 text-sm font-bold uppercase tracking-widest transition-colors',
          onAir
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-dial/60 bg-background/5 hover:bg-background/10',
        )}
        style={onAir ? { boxShadow: `0 0 0 ${4 + level * 22}px oklch(0.7 0.17 30 / 0.3)` } : undefined}
      >
        {onAir ? <MicOff className="size-8" aria-hidden="true" /> : <Mic className="size-8" aria-hidden="true" />}
        {onAir ? 'Avslutt' : 'Gå direkte'}
      </button>

      <div className="flex w-full flex-col gap-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-background/15" aria-hidden="true">
          <div
            className="h-full rounded-full bg-dial transition-[width] duration-75"
            style={{ width: `${level * 100}%` }}
          />
        </div>
        <p className="text-center text-xs leading-relaxed opacity-70">
          {mode === 'pause'
            ? 'Programmet settes på pause mens du snakker og fortsetter når du avslutter.'
            : 'Musikken dempes mens du snakker.'}{' '}
          Lytterne hører deg med noen sekunders forsinkelse.
        </p>
      </div>
    </section>
  )
}
