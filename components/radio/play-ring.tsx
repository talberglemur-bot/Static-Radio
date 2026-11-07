import { ChevronRight, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

const R = 25
const CIRC = 2 * Math.PI * R

export function PlayRing({
  progress,
  playing,
  className,
}: {
  progress: number
  playing: boolean
  className?: string
}) {
  const p = Math.min(1, Math.max(0, progress))
  return (
    <span className={cn('relative flex size-14 shrink-0 items-center justify-center', className)} aria-hidden="true">
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90">
        <circle cx="28" cy="28" r={R} fill="none" strokeWidth="2.5" className="stroke-primary/25" />
        <circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - p)}
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {playing ? (
          <Pause className="size-5 fill-current" strokeWidth={0} />
        ) : (
          <ChevronRight className="size-6" strokeWidth={3.5} />
        )}
      </span>
    </span>
  )
}
