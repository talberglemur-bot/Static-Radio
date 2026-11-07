'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, MessageCircle, Radio, SlidersHorizontal, Smile } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useMe } from '@/hooks/use-me'
import { cn } from '@/lib/utils'

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-baseline gap-1.5 leading-none', className)}>
      <span className="font-black tracking-tighter">STATIC</span>
      <span className="font-normal">Radio</span>
    </span>
  )
}

type NavItem = { href: string; label: string; icon: typeof Radio; active: boolean }

export function SiteHeader({ variant = 'listener' }: { variant?: 'listener' | 'staff' }) {
  const { me, isStaff, mutate } = useMe()
  const router = useRouter()
  const pathname = usePathname()

  async function signOut() {
    await authClient.signOut()
    await mutate(null, { revalidate: false })
    router.push('/')
    router.refresh()
  }

  const items: NavItem[] = [
    { href: '/', label: 'Direkte', icon: Radio, active: pathname === '/' },
    { href: '/#prat', label: 'Prat', icon: MessageCircle, active: false },
  ]
  if (isStaff) {
    items.push({ href: '/staff', label: 'Studio', icon: SlidersHorizontal, active: pathname === '/staff' })
  }

  const navItem =
    'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors'

  return (
    <header className="flex flex-col items-center gap-4 pt-3 pb-2">
      <Link href="/" className="flex min-h-11 items-center text-3xl" aria-label="Static Radio, forsiden">
        <Wordmark />
        {variant === 'staff' && (
          <span className="ml-2 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            Studio
          </span>
        )}
      </Link>

      <nav aria-label="Hovedmeny" className="w-full">
        <ul className="grid auto-cols-fr grid-flow-col">
          {items.map(({ href, label, icon: Icon, active }) => (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(navItem, active ? 'text-accent' : 'text-foreground hover:text-accent')}
              >
                <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
          <li>
            {me ? (
              <button
                type="button"
                onClick={signOut}
                className={cn(navItem, 'w-full text-foreground hover:text-accent')}
                aria-label={`Logg ut ${me.name}`}
              >
                <LogOut className="size-6" strokeWidth={1.75} aria-hidden="true" />
                <span className="max-w-full truncate">Logg ut</span>
              </button>
            ) : (
              <Link href="/sign-in" className={cn(navItem, 'text-foreground hover:text-accent')}>
                <Smile className="size-6" strokeWidth={1.75} aria-hidden="true" />
                Logg på
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </header>
  )
}
