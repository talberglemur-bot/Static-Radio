'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Check, Loader2, Pencil, Plus, Radio, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { control } from './control'

type Station = { id: string; name: string; src: string }

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Kunne ikke hente kanaler')
    return r.json() as Promise<{ stations: Station[] }>
  })

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Noe gikk galt')
  return json
}

/** Tries the stream in the browser (with CORS, like listeners) before it's saved, so dead links never reach air. */
function probeStream(src: string, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio()
    a.crossOrigin = 'anonymous'
    a.preload = 'auto'
    a.muted = true
    const done = (ok: boolean) => {
      clearTimeout(timer)
      a.removeAttribute('src')
      a.load()
      ok ? resolve() : reject(new Error('Strømmen kunne ikke spilles av. Sjekk lenken.'))
    }
    const timer = setTimeout(() => done(false), timeoutMs)
    a.addEventListener('canplay', () => done(true), { once: true })
    a.addEventListener('error', () => done(false), { once: true })
    a.src = src
    a.load()
  })
}

export function RelayPanel({ slug, activeId }: { slug: string; activeId: string | null }) {
  const { data, mutate, isLoading } = useSWR('/api/relay-stations', fetcher)
  const stations = data?.stations ?? []
  const [editing, setEditing] = useState(false)

  const choose = async (id: string | null) => {
    try {
      await control(slug, { type: 'relay', streamId: id })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Noe gikk galt')
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Radio className="size-4" aria-hidden="true" />
          Videresend NRK-radio
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          aria-pressed={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? <Check className="size-4" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />}
          {editing ? 'Ferdig' : 'Rediger'}
        </Button>
      </div>
      <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
        Send en NRK-kanal direkte i stedet for spillelisten. Reklamepauser, mikrofon, pause og lydeffekter fungerer fortsatt over sendingen.
      </p>

      {editing ? (
        <div className="flex flex-col gap-2">
          {stations.map((s) => (
            <StationEditor key={s.id} station={s} onChanged={() => mutate()} />
          ))}
          <AddStation onAdded={() => mutate()} />
        </div>
      ) : (
        <div role="radiogroup" aria-label="Kilde" className="grid grid-cols-2 gap-2">
          <SourceButton on={activeId === null} onClick={() => choose(null)}>
            Egen spilleliste
          </SourceButton>
          {stations.map((s) => (
            <SourceButton key={s.id} on={activeId === s.id} onClick={() => choose(s.id)}>
              {s.name}
            </SourceButton>
          ))}
          {isLoading && (
            <div className="col-span-2 flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Henter kanaler
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SourceButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'min-h-11 truncate rounded-lg border px-3 text-sm font-medium transition-all duration-200 active:scale-[0.98]',
        on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-secondary',
      )}
    >
      {children}
    </button>
  )
}

function StationEditor({ station, onChanged }: { station: Station; onChanged: () => void }) {
  const [name, setName] = useState(station.name)
  const [url, setUrl] = useState(station.src)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const dirty = name.trim() !== station.name || url.trim() !== station.src

  const save = async () => {
    setBusy('save')
    try {
      if (url.trim() !== station.src) await probeStream(url.trim())
      await send(`/api/relay-stations/${station.id}`, 'PATCH', {
        name: name.trim(),
        ...(url.trim() !== station.src ? { url: url.trim() } : {}),
      })
      toast.success('Lagret')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Noe gikk galt')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirm(`Slette ${station.name}?`)) return
    setBusy('delete')
    try {
      await send(`/api/relay-stations/${station.id}`, 'DELETE')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Noe gikk galt')
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <Label htmlFor={`name-${station.id}`} className="sr-only">
        Navn
      </Label>
      <Input
        id={`name-${station.id}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        className="min-h-11 text-base"
      />
      <Label htmlFor={`url-${station.id}`} className="sr-only">
        Lenke
      </Label>
      <Input
        id={`url-${station.id}`}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        className="min-h-11 font-mono text-base md:text-xs"
      />
      <div className="flex gap-2">
        <Button type="button" className="min-h-11 flex-1" disabled={!dirty || !!busy} onClick={save}>
          {busy === 'save' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
          Lagre
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!!busy}
          onClick={remove}
          aria-label={`Slett ${station.name}`}
        >
          {busy === 'delete' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  )
}

function AddStation({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    try {
      // Server normalizes radio.nrk.no/direkte/... into the real stream; probe that exact URL.
      const { station } = (await send('/api/relay-stations', 'POST', { name: name.trim(), url: url.trim() })) as {
        station: Station
      }
      try {
        await probeStream(station.src)
      } catch (err) {
        await send(`/api/relay-stations/${station.id}`, 'DELETE').catch(() => {})
        throw err
      }
      toast.success(`${station.name} lagt til`)
      setName('')
      setUrl('')
      setOpen(false)
      onAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Legg til NRK-kanal
      </Button>
    )
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-3 rounded-lg border border-primary/40 p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-relay-url">Lenke</Label>
        <Input
          id="new-relay-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://radio.nrk.no/direkte/p3"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className="min-h-11 text-base"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Lim inn en side fra radio.nrk.no/direkte eller en direkte lydstrøm (https).
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-relay-name">Navn</Label>
        <Input
          id="new-relay-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hentes fra lenken hvis tomt"
          maxLength={40}
          className="min-h-11 text-base"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="min-h-11 flex-1" disabled={busy || !url.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {busy ? 'Tester strømmen' : 'Legg til'}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setOpen(false)} aria-label="Avbryt">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}
