'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendJson } from '@/lib/fetcher'

type Created = { slug: string; name: string; frequency: string }

export function NewChannelForm({ onCreated }: { onCreated: (c: Created) => void }) {
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await sendJson<Created>('/api/channels', 'POST', {
        name,
        frequency: frequency.replace(',', '.'),
        description,
      })
      toast.success(`${created.name} er opprettet`)
      setName('')
      setFrequency('')
      setDescription('')
      onCreated(created)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunne ikke opprette kanalen')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <h2 className="text-sm font-semibold">Ny radiokanal</h2>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-name">Navn</Label>
          <Input id="new-name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11 text-base" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-freq">Frekvens</Label>
          <Input
            id="new-freq"
            required
            inputMode="decimal"
            placeholder="99,3"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-desc">Undertittel</Label>
        <Input id="new-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} className="h-11 text-base" />
      </div>
      <Button type="submit" disabled={saving} className="h-11 rounded-full">
        {saving ? 'Oppretter…' : 'Opprett kanal'}
      </Button>
    </form>
  )
}
