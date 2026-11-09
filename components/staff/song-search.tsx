'use client'

import { useState, type FormEvent } from 'react'
import { Check, ListPlus, Loader2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendJson } from '@/lib/fetcher'

type SongHit = {
  itunesId: number
  title: string
  artist: string
  album: string
  artwork: string | null
}

export function SongSearch({ slug, onAdded }: { slug: string; onAdded: () => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SongHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState<Record<number, 'add' | 'queue'>>({})
  const [added, setAdded] = useState<Record<number, boolean>>({})

  async function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return
    setSearching(true)
    try {
      const res = await fetch(`/api/tracks/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Søket feilet')
      setHits(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Søket feilet')
    } finally {
      setSearching(false)
    }
  }

  async function add(hit: SongHit, queue: boolean) {
    setBusy((b) => ({ ...b, [hit.itunesId]: queue ? 'queue' : 'add' }))
    try {
      const res = await sendJson<{ song: { reused: boolean }; queuedOn: string | null }>(
        '/api/tracks/search',
        'POST',
        { itunesId: hit.itunesId, queueSlug: queue ? slug : undefined },
      )
      setAdded((a) => ({ ...a, [hit.itunesId]: true }))
      onAdded()
      toast.success(
        res.queuedOn
          ? `«${hit.title}» er neste på ${res.queuedOn}`
          : res.song.reused
            ? `«${hit.title}» finnes allerede i biblioteket`
            : `«${hit.title}» lagt til i biblioteket`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunne ikke legge til låta')
    } finally {
      setBusy(({ [hit.itunesId]: _, ...rest }) => rest)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Finn låt på nettet</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Søk, og legg låta rett i biblioteket. Du får et 30 sekunders utdrag.
        </p>
      </div>
      <form onSubmit={search} className="flex gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Artist eller låttittel"
          aria-label="Søk etter låt på nettet"
          enterKeyHint="search"
          className="h-11 flex-1 text-base"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={searching} aria-label="Søk">
          {searching ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
        </Button>
      </form>

      {hits && hits.length === 0 && (
        <p className="text-sm text-muted-foreground">Ingen treff. Prøv et annet søk.</p>
      )}

      {hits && hits.length > 0 && (
        <ul className="flex flex-col divide-y">
          {hits.map((h) => {
            const state = busy[h.itunesId]
            const done = added[h.itunesId]
            return (
              <li
                key={h.itunesId}
                className="flex animate-in fade-in slide-in-from-bottom-1 items-center gap-3 py-2.5 duration-300"
              >
                {h.artwork ? (
                  <img
                    src={h.artwork}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    className="size-12 shrink-0 rounded-md bg-secondary object-cover"
                  />
                ) : (
                  <div className="size-12 shrink-0 rounded-md bg-secondary" aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{h.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {h.artist}
                    {h.album ? ` · ${h.album}` : ''}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  disabled={!!state}
                  onClick={() => add(h, false)}
                  aria-label={`Legg «${h.title}» i biblioteket`}
                >
                  {state === 'add' ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : done ? (
                    <Check className="size-5 text-primary" />
                  ) : (
                    <Plus className="size-5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  disabled={!!state}
                  onClick={() => add(h, true)}
                  aria-label={`Legg «${h.title}» i biblioteket og spill neste`}
                >
                  {state === 'queue' ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ListPlus className="size-5" />
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
