'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Ear } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { BUILT_IN_SFX } from '@/lib/sfx-catalog'
import { fetcher } from '@/lib/fetcher'
import type { RadioEngine } from '@/hooks/use-radio-engine'
import { cn } from '@/lib/utils'
import { control, type LibraryTrack } from './control'

export function SfxPad({ slug, engine }: { slug: string; engine: RadioEngine }) {
  const [previewOnly, setPreviewOnly] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const { data: tracks = [] } = useSWR<LibraryTrack[]>('/api/tracks', fetcher)
  const custom = tracks.filter((t) => t.kind === 'sfx')

  async function fire(key: string, payload: { kind?: string; trackId?: number }, src: string | null) {
    setFlash(key)
    setTimeout(() => setFlash((f) => (f === key ? null : f)), 300)
    if (previewOnly || engine.tunedIn === false) {
      engine.previewSfx(payload.kind ?? 'custom', src)
    }
    if (!previewOnly) await control(slug, { type: 'sfx', ...payload })
  }

  const pads = [
    ...BUILT_IN_SFX.map((s) => ({ key: s.kind, label: s.label, payload: { kind: s.kind }, src: null })),
    ...custom.map((t) => ({
      key: `t${t.id}`,
      label: t.title,
      payload: { trackId: t.id },
      src: t.src,
    })),
  ]

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Lydbrett</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="sfx-preview" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Ear className="size-3.5" aria-hidden="true" />
            Kun forhåndslytt
          </Label>
          <Switch id="sfx-preview" checked={previewOnly} onCheckedChange={setPreviewOnly} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {pads.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => fire(p.key, p.payload, p.src)}
            className={cn(
              'flex aspect-square flex-col items-start justify-end rounded-xl border-b-4 p-2.5 text-left text-sm font-semibold leading-tight transition-all active:translate-y-0.5 active:border-b-2',
              flash === p.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-foreground/20 bg-secondary hover:bg-muted',
            )}
          >
            <span className="line-clamp-2">{p.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Knappene spilles for alle som lytter. Last opp egne jingler i Bibliotek som «Lydeffekt».
      </p>
    </section>
  )
}
