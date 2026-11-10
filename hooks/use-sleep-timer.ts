'use client'

import { useEffect, useRef, useState } from 'react'

export function useSleepTimer(onExpire: () => void) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= endsAt) {
        setEndsAt(null)
        onExpireRef.current()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return {
    remainingMin: endsAt ? Math.max(1, Math.ceil((endsAt - now) / 60_000)) : null,
    start: (minutes: number) => {
      setNow(Date.now())
      setEndsAt(Date.now() + minutes * 60_000)
    },
    cancel: () => setEndsAt(null),
  }
}
