'use client'

import { useRef, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { upload } from '@vercel/blob/client'
import { ListPlus, Pencil, Play, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetcher, formatTime, sendJson } from '@/lib/fetcher'
import { cn } from '@/lib/utils'
import { control, type LibraryTrack } from './control'

const MULTIPART_FROM = 8 * 1024 * 1024

const EXT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
}

// Some phones report an empty or video/* type for audio files.
function audioType(file: File) {
  if (file.type.startsWith('audio/')) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TYPES[ext] ?? 'audio/mpeg'
}

function metadataDuration(file: File, timeoutMs: number) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('audio')
    const done = (fn: () => void) => {
      clearTimeout(timer)
      a.removeAttribute('src')
      a.load()
      URL.revokeObjectURL(url)
      fn()
    }
    const check = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) done(() => resolve(a.duration))
    }
    const timer = setTimeout(() => done(() => reject(new Error('timeout'))), timeoutMs)
    a.preload = 'metadata'
    a.muted = true
    a.onloadedmetadata = check
    a.ondurationchange = check
    a.onerror = () => done(() => reject(new Error('unreadable')))
    a.src = url
    a.load()
  })
}

async function decodeDuration(file: File) {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer())
    return buf.duration
  } finally {
    ctx.close().catch(() => {})
  }
}

// iOS often never fires loadedmetadata for local files, so never wait forever.
async function readDuration(file: File) {
  try {
    return await metadataDuration(file, 4000)
  } catch {}
  if (file.size <= 40 * 1024 * 1024) {
    try {
      return await decodeDuration(file)
    } catch {}
  }
  return Math.max(1, (file.size * 8) / 192_000)
}

let storeAccess: 'private' | 'public' | null = null

async function uploadToBlob(file: File, onProgress: (pct: number) => void) {
  const options = {
    handleUploadUrl: '/api/tracks/upload',
    contentType: audioType(file),
    multipart: file.size >= MULTIPART_FROM,
    onUploadProgress: ({ percentage }: { percentage: number }) => onProgress(percentage),
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'lyd'
  const path = `tracks/${safeName}`
  const order: ('private' | 'public')[] = storeAccess ? [storeAccess] : ['private', 'public']
  let lastErr: unknown
  for (const access of order) {
    try {
      const blob = await upload(path, file, { ...options, access })
      storeAccess = access
      return { access, pathname: access === 'public' ? blob.url : blob.pathname }
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (!msg.includes('access') && !msg.includes('public') && !msg.includes('private')) break
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Opplastingen feilet')
}

type Job = { name: string; pct: number; state: 'venter' | 'laster' | 'ferdig' | 'feil' }

type TrackKind = LibraryTrack['kind']
const KIND_LABEL: Record<TrackKind, string> = { music: 'Låt', sfx: 'Lydeffekt', ad: 'Reklame' }

export function UploadForm({
  onDone,
  fixedKind,
  heading = 'Legg til lyd',
}: {
  onDone: () => void
  fixedKind?: TrackKind
  heading?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const idPrefix = fixedKind ?? 'lib'
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [pickedKind, setKind] = useState<TrackKind>('music')
  const kind = fixedKind ?? pickedKind
  const [busy, setBusy] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])

  const patchJob = (i: number, patch: Partial<Job>) =>
    setJobs((js) => js.map((j, idx) => (idx === i ? { ...j, ...patch } : j)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const files = Array.from(fileRef.current?.files ?? [])
    if (files.length === 0) return
    setBusy(true)
    setJobs(files.map((f) => ({ name: f.name, pct: 0, state: 'venter' })))
    let ok = 0
    for (const [i, file] of files.entries()) {
      patchJob(i, { state: 'laster' })
      try {
        const [durationSec, stored] = await Promise.all([
          readDuration(file),
          uploadToBlob(file, (pct) => patchJob(i, { pct })),
        ])
        await sendJson('/api/tracks', 'POST', {
          title: (files.length === 1 && title) || file.name.replace(/\.[^.]+$/, ''),
          artist,
          kind,
          durationSec,
          ...stored,
        })
        patchJob(i, { state: 'ferdig', pct: 100 })
        ok++
        onDone()
      } catch (err) {
        patchJob(i, { state: 'feil' })
        toast.error(`${file.name}: ${err instanceof Error ? err.message : 'Opplastingen feilet'}`)
      }
    }
    if (ok > 0) toast.success(ok === 1 ? 'Lyden er lagt til' : `${ok} filer lagt til`)
    setTitle('')
    setArtist('')
    if (fileRef.current) fileRef.current.value = ''
    setBusy(false)
    setTimeout(() => setJobs((js) => js.filter((j) => j.state === 'feil')), 2500)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <h2 className="text-sm font-semibold">{heading}</h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-file`}>Lydfiler</Label>
        <Input
          id={`${idPrefix}-file`}
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac"
          multiple
          required
          disabled={busy}
          className="h-11 text-base"
        />
        <p className="text-xs text-muted-foreground">Du kan velge flere filer samtidig. Opptil 200 MB per fil.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-title`}>Tittel</Label>
          <Input
            id={`${idPrefix}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bruker filnavnet hvis tomt"
            className="h-11 text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-artist`}>{kind === 'ad' ? 'Annonsør' : 'Artist'}</Label>
          <Input
            id={`${idPrefix}-artist`}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>
      {!fixedKind && (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Type</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['music', 'sfx', 'ad'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                'min-h-11 rounded-lg border text-sm font-medium',
                kind === k ? 'border-foreground bg-accent text-accent-foreground' : 'bg-background',
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </fieldset>
      )}
      {jobs.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {jobs.map((j, i) => (
            <li key={`${j.name}-${i}`} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{j.name}</span>
                <span className={cn('shrink-0 tabular-nums', j.state === 'feil' ? 'text-destructive' : 'text-muted-foreground')}>
                  {j.state === 'laster' ? `${Math.round(j.pct)} %` : j.state === 'ferdig' ? 'Ferdig' : j.state === 'feil' ? 'Feilet' : 'Venter'}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-label={`Opplasting av ${j.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(j.pct)}
              >
                <div
                  className={cn('h-full rounded-full transition-[width] duration-300 ease-out', j.state === 'feil' ? 'bg-destructive' : 'bg-primary')}
                  style={{ width: `${j.state === 'feil' ? 100 : j.pct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button type="submit" disabled={busy} className="h-11 rounded-full">
        <Upload className="size-4" aria-hidden="true" />
        {busy ? 'Laster opp…' : 'Last opp'}
      </Button>
    </form>
  )
}

function TrackRow({
  t,
  slug,
  onChange,
}: {
  t: LibraryTrack
  slug: string
  onChange: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(t.title)
  const [artist, setArtist] = useState(t.artist)

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      await sendJson(`/api/tracks/${t.id}`, 'PATCH', { title, artist })
      setEditing(false)
      onChange()
    } catch {
      toast.error('Kunne ikke lagre endringene')
    }
  }

  async function remove() {
    if (!confirm(`Slette «${t.title}» fra biblioteket?`)) return
    try {
      await sendJson(`/api/tracks/${t.id}`, 'DELETE', {})
      onChange()
    } catch {
      toast.error('Kunne ikke slette')
    }
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={save} className="flex flex-col gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Tittel" className="h-11 text-base" />
          <Input value={artist} onChange={(e) => setArtist(e.target.value)} aria-label="Artist" className="h-11 text-base" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-10 flex-1">
              Lagre
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-10 flex-1" onClick={() => setEditing(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-1 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{t.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {t.artist} · {formatTime(t.durationSec)}
        </span>
      </div>
      {t.kind === 'music' && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => control(slug, { type: 'play', trackId: t.id })}
            aria-label={`Spill ${t.title} nå`}
          >
            <Play className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={async () => {
              if (await control(slug, { type: 'enqueue', trackId: t.id })) toast.success('Lagt i kø')
            }}
            aria-label={`Legg ${t.title} i køen`}
          >
            <ListPlus className="size-4" />
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" className="size-11" onClick={() => setEditing(true)} aria-label={`Rediger ${t.title}`}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-11 text-destructive" onClick={remove} aria-label={`Slett ${t.title}`}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}

export function LibraryPanel({ slug }: { slug: string }) {
  const { data: tracks = [], mutate, isLoading } = useSWR<LibraryTrack[]>('/api/tracks', fetcher)
  const [filter, setFilter] = useState<TrackKind>('music')
  const [query, setQuery] = useState('')
  const shown = tracks.filter(
    (t) =>
      t.kind === filter &&
      `${t.title} ${t.artist}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <>
      <UploadForm onDone={() => mutate()} />
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Bibliotek</h2>
          <div className="flex rounded-full bg-secondary p-1 text-xs">
            {(['music', 'sfx', 'ad'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={cn(
                  'min-h-9 rounded-full px-2.5 font-medium transition-colors duration-200',
                  filter === k ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
              >
                {k === 'music' ? 'Låter' : k === 'sfx' ? 'Effekter' : 'Reklamer'} ({tracks.filter((t) => t.kind === k).length})
              </button>
            ))}
          </div>
        </div>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter tittel eller artist"
          aria-label="Søk i biblioteket"
          className="h-11 text-base"
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laster…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ingenting her ennå. Last opp en lydfil over.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {shown.map((t) => (
              <TrackRow key={t.id} t={t} slug={slug} onChange={() => mutate()} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
