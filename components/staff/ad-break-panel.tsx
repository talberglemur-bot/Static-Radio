'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { AudioLines, Megaphone, Square } from 'lucide-react'
import { toast } from 'sonner'
import { AD_JINGLE_SEC, BUILT_IN_ADS, estimateAdSeconds, type AdItem } from '@/lib/ad-catalog'
import { fetcher } from '@/lib/fetcher'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { control, type LibraryTrack } from './control'
import { UploadForm } from './library-panel'

const keyOf = (item: AdItem) => `${item.type}:${item.id}`

export function AdBreakPanel({ slug, onBreak }: { slug: string; onBreak: boolean }) {
  const { data: tracks = [], mutate } = useSWR<LibraryTrack[]>('/api/tracks', fetcher)
  const uploadedAds = tracks.filter((t) => t.kind === 'ad')
  const [selected, setSelected] = useState<AdItem[]>(
    BUILT_IN_ADS.slice(0, 2).map((a) => ({ type: 'tts', id: a.id })),
  )
  const [busy, setBusy] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const total =
    AD_JINGLE_SEC +
    selected.reduce((sum, item) => {
      if (item.type === 'tts') {
        const ad = BUILT_IN_ADS.find((a) => a.id === item.id)
        return ad ? sum + estimateAdSeconds(ad.script) : sum
      }
      const t = uploadedAds.find((a) => a.id === item.id)
      return t ? sum + t.durationSec : sum
    }, 0)

  function toggle(item: AdItem) {
    const k = keyOf(item)
    setSelected((s) => (s.some((x) => keyOf(x) === k) ? s.filter((x) => keyOf(x) !== k) : [...s, item]))
  }

  async function start() {
    if (!selected.length) return
    setBusy(true)
    if (await control(slug, { type: 'adBreak', items: selected })) toast.success('Reklamepausen er i gang')
    setBusy(false)
  }

  async function stop() {
    setBusy(true)
    await control(slug, { type: 'endAdBreak' })
    setBusy(false)
  }

  const rows: { item: AdItem; title: string; sub: string; uploaded: boolean }[] = [
    ...uploadedAds.map((t) => ({
      item: { type: 'track' as const, id: t.id },
      title: t.title,
      sub: `${t.artist || 'Opplastet lydfil'} · ${Math.round(t.durationSec)} sek`,
      uploaded: true,
    })),
    ...BUILT_IN_ADS.map((ad) => ({
      item: { type: 'tts' as const, id: ad.id },
      title: ad.advertiser,
      sub: ad.script,
      uploaded: false,
    })),
  ]

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone className="size-4" aria-hidden="true" />
          Reklamepause
        </h2>
        <span className="font-mono text-xs text-muted-foreground">ca. {Math.round(total)} sek</span>
      </div>

      <ul className="flex flex-col divide-y">
        {rows.map(({ item, title, sub, uploaded }) => {
          const on = selected.some((x) => keyOf(x) === keyOf(item))
          const order = selected.findIndex((x) => keyOf(x) === keyOf(item)) + 1
          return (
            <li key={keyOf(item)}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(item)}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors duration-200',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                  )}
                >
                  {on ? order : ''}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {uploaded && <AudioLines className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
                    <span className="truncate">{title}</span>
                  </span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{sub}</span>
                </span>
                {!uploaded && <span className="shrink-0 text-xs text-muted-foreground">Opplest</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {showUpload ? (
        <div className="rounded-lg border p-3">
          <UploadForm
            fixedKind="ad"
            heading="Last opp reklame"
            onDone={() => {
              mutate()
              setShowUpload(false)
            }}
          />
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowUpload(true)} className="h-11 rounded-full">
          <AudioLines className="size-4" aria-hidden="true" />
          Last opp reklamelyd
        </Button>
      )}

      {onBreak ? (
        <Button onClick={stop} disabled={busy} variant="secondary" className="h-11 rounded-full">
          <Square className="size-4" aria-hidden="true" />
          Avslutt reklamepausen
        </Button>
      ) : (
        <Button onClick={start} disabled={busy || !selected.length} className="h-11 rounded-full">
          Start reklamepause ({selected.length})
        </Button>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Programmet pauses, reklamene spilles i valgt rekkefølge hos alle lyttere, og sendingen fortsetter der den
        slapp.
      </p>
    </section>
  )
}
