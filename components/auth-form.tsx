'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Wordmark } from '@/components/radio/site-header'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password })
    setLoading(false)
    if (error) {
      setError(
        isSignUp
          ? 'Kunne ikke opprette kontoen. Prøv en annen e-post.'
          : 'Feil e-post eller passord.',
      )
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex min-h-11 items-center self-center text-3xl" aria-label="Static Radio, forsiden">
          <Wordmark />
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            {isSignUp ? 'Opprett konto' : 'Velkommen tilbake'}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isSignUp
              ? 'Chat med programlederne og ønsk deg låter. Den første kontoen som opprettes blir administrator.'
              : 'Logg på for å chatte, ønske deg låter eller åpne studio.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg bg-card p-5">
          {isSignUp && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Visningsnavn</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={40}
                autoComplete="nickname"
                className="h-11 text-base"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Passord</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="h-11 text-base"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-full">
            {loading ? 'Vent litt…' : isSignUp ? 'Opprett konto' : 'Logg på'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? 'Har du allerede en konto? ' : 'Ny her? '}
          <Link
            href={isSignUp ? '/sign-in' : '/sign-up'}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {isSignUp ? 'Logg på' : 'Opprett en konto'}
          </Link>
        </p>
      </div>
    </main>
  )
}
