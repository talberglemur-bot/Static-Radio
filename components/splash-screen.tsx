'use client'

import { useEffect, useState } from 'react'

const SEEN_KEY = 'stc-splash-seen'
const HOLD_MS = 2400
const EXIT_MS = 600

export const splashBootScript = `try{if(sessionStorage.getItem('${SEEN_KEY}'))document.documentElement.dataset.splashSeen='1'}catch(e){}`

type Phase = 'enter' | 'exit' | 'done'

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('enter')

  useEffect(() => {
    if (document.documentElement.dataset.splashSeen) {
      setPhase('done')
      return
    }
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {}

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hold = reduced ? 700 : HOLD_MS
    const exitTimer = window.setTimeout(() => setPhase('exit'), hold)
    const doneTimer = window.setTimeout(() => setPhase('done'), hold + EXIT_MS)
    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(doneTimer)
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div
      id="stc-splash"
      aria-hidden="true"
      data-phase={phase}
      className="splash fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-splash text-splash-foreground"
    >
      <div className="relative flex items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="splash-wave absolute size-40 rounded-full border border-splash-foreground/40"
            style={{ animationDelay: `${300 + i * 380}ms` }}
          />
        ))}

        <div className="splash-mark relative flex flex-col items-center">
          <div className="flex font-sans text-8xl font-extrabold leading-none tracking-tight">
            {['S', 'T', 'C'].map((letter, i) => (
              <span
                key={letter}
                className="splash-letter inline-block"
                style={{ animationDelay: `${120 + i * 110}ms` }}
              >
                {letter}
              </span>
            ))}
          </div>
          <span className="splash-sub mt-2 font-sans text-5xl font-normal leading-none">Radio</span>
          <span className="splash-bar mt-6 h-1 w-16 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  )
}
