'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { control } from './control'

export function StationSettings({
  slug,
  channel,
}: {
  slug: string
  channel: { name: string; description: string; ticker: string }
}) {
  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description)
  const [ticker, setTicker] = useState(channel.ticker)
  const [saving, setSaving] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (await control(slug, { type: 'details', name, description, ticker })) toast.success('Kanalen er oppdatert')
    setSaving(false)
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <h2 className="text-sm font-semibold">Kanalinformasjon</h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ch-name">Navn</Label>
        <Input id="ch-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ch-desc">Undertittel</Label>
        <Input
          id="ch-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={140}
          className="h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ch-ticker">Rullende tekst</Label>
        <Textarea
          id="ch-ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          maxLength={200}
          rows={2}
          className="text-base"
        />
        <span className="text-xs text-muted-foreground">Vises for alle lyttere under spilleren.</span>
      </div>
      <Button type="submit" disabled={saving} className="h-11 rounded-full">
        {saving ? 'Lagrer…' : 'Lagre'}
      </Button>
    </form>
  )
}
