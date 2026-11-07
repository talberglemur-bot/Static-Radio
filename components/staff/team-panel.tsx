'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetcher, sendJson } from '@/lib/fetcher'

type Member = { id: string; name: string; email: string; role: 'admin' | 'staff' }

export function TeamPanel({ isAdmin }: { isAdmin: boolean }) {
  const { data: team = [], mutate } = useSWR<Member[]>('/api/staff', fetcher)
  const [email, setEmail] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await sendJson('/api/staff', 'POST', { email })
      setEmail('')
      toast.success('Lagt til i teamet')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunne ikke legge til')
    }
  }

  async function remove(id: string) {
    try {
      await sendJson('/api/staff', 'DELETE', { id })
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunne ikke fjerne')
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <h2 className="text-sm font-semibold">Kanalteamet</h2>
      <ul className="flex flex-col divide-y">
        {team.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{m.name}</span>
              <span className="truncate text-xs text-muted-foreground">{m.email}</span>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs uppercase">{m.role === 'admin' ? 'Admin' : 'Medarbeider'}</span>
            {isAdmin && m.role !== 'admin' && (
              <Button variant="ghost" size="icon" className="size-11" onClick={() => remove(m.id)} aria-label={`Fjern ${m.name} fra teamet`}>
                <UserMinus className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <form onSubmit={add} className="flex flex-col gap-2">
          <Label htmlFor="staff-email">Legg til medarbeider med e-post</Label>
          <div className="flex gap-2">
            <Input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dj@eksempel.no"
              className="h-11 text-base"
            />
            <Button type="submit" className="h-11">
              Legg til
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">Personen må opprette en konto først.</span>
        </form>
      )}
    </section>
  )
}
