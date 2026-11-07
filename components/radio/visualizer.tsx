'use client'

import { useEffect, useRef, type RefObject } from 'react'

const BARS = 28

export function Visualizer({
  analyserRef,
  active,
  className,
}: {
  analyserRef: RefObject<AnalyserNode | null>
  active: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const levels = new Float32Array(BARS)
    const color = getComputedStyle(canvas).color

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const analyser = analyserRef.current
      const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
      if (analyser && bins && active) analyser.getByteFrequencyData(bins)

      const gap = 3
      const bw = (w - gap * (BARS - 1)) / BARS
      ctx.fillStyle = color
      for (let i = 0; i < BARS; i++) {
        const target = bins && active ? bins[Math.min(bins.length - 1, i)] / 255 : 0
        levels[i] += (target - levels[i]) * 0.3
        const bh = Math.max(2, levels[i] * h)
        ctx.globalAlpha = 0.35 + levels[i] * 0.65
        ctx.fillRect(i * (bw + gap), h - bh, bw, bh)
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [analyserRef, active])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
