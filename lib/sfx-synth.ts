import type { BuiltInSfxKind } from '@/lib/sfx-catalog'

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function envGain(ctx: AudioContext, out: AudioNode, start: number, peak: number, attack: number, release: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(peak, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release)
  g.connect(out)
  return g
}

/** Plays a synthesized station sound effect. Everything is generated with Web Audio, so no files are needed. */
export function playSynthSfx(ctx: AudioContext, out: AudioNode, kind: BuiltInSfxKind) {
  const t = ctx.currentTime + 0.02

  switch (kind) {
    case 'airhorn': {
      for (let burst = 0; burst < 3; burst++) {
        const s = t + burst * 0.28
        const len = burst === 2 ? 0.7 : 0.18
        const g = envGain(ctx, out, s, 0.35, 0.01, len)
        ;[440, 554, 659].forEach((f) => {
          const o = ctx.createOscillator()
          o.type = 'sawtooth'
          o.frequency.setValueAtTime(f, s)
          o.frequency.linearRampToValueAtTime(f * 0.97, s + len)
          o.connect(g)
          o.start(s)
          o.stop(s + len + 0.05)
        })
      }
      break
    }
    case 'siren': {
      const g = envGain(ctx, out, t, 0.25, 0.05, 1.8)
      const o = ctx.createOscillator()
      o.type = 'square'
      for (let i = 0; i < 4; i++) {
        o.frequency.setValueAtTime(600, t + i * 0.45)
        o.frequency.linearRampToValueAtTime(1100, t + i * 0.45 + 0.225)
        o.frequency.linearRampToValueAtTime(600, t + i * 0.45 + 0.45)
      }
      o.connect(g)
      o.start(t)
      o.stop(t + 1.9)
      break
    }
    case 'laser': {
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.14
        const g = envGain(ctx, out, s, 0.3, 0.005, 0.18)
        const o = ctx.createOscillator()
        o.type = 'square'
        o.frequency.setValueAtTime(1800, s)
        o.frequency.exponentialRampToValueAtTime(120, s + 0.18)
        o.connect(g)
        o.start(s)
        o.stop(s + 0.2)
      }
      break
    }
    case 'rewind': {
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx, 1)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 6
      bp.frequency.setValueAtTime(400, t)
      bp.frequency.exponentialRampToValueAtTime(4000, t + 0.35)
      bp.frequency.exponentialRampToValueAtTime(300, t + 0.8)
      const g = envGain(ctx, out, t, 0.9, 0.02, 0.8)
      src.connect(bp).connect(g)
      src.start(t)
      src.stop(t + 0.9)
      break
    }
    case 'drop': {
      const g = envGain(ctx, out, t, 0.7, 0.01, 1.6)
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(180, t)
      o.frequency.exponentialRampToValueAtTime(32, t + 1.4)
      o.connect(g)
      o.start(t)
      o.stop(t + 1.7)
      break
    }
    case 'drumroll': {
      const buf = noiseBuffer(ctx, 0.08)
      for (let i = 0; i < 28; i++) {
        const s = t + i * 0.055
        const src = ctx.createBufferSource()
        src.buffer = buf
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 1200
        const g = envGain(ctx, out, s, 0.12 + (i / 28) * 0.35, 0.002, 0.06)
        src.connect(hp).connect(g)
        src.start(s)
      }
      const crash = ctx.createBufferSource()
      crash.buffer = noiseBuffer(ctx, 1.2)
      const g = envGain(ctx, out, t + 1.55, 0.5, 0.005, 1.1)
      crash.connect(g)
      crash.start(t + 1.55)
      break
    }
    case 'applause': {
      const buf = noiseBuffer(ctx, 0.04)
      for (let i = 0; i < 90; i++) {
        const s = t + Math.random() * 2
        const src = ctx.createBufferSource()
        src.buffer = buf
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 900 + Math.random() * 1800
        const g = envGain(ctx, out, s, 0.08 + Math.random() * 0.12, 0.002, 0.04)
        src.connect(bp).connect(g)
        src.start(s)
      }
      break
    }
    case 'chime': {
      ;[784, 988, 1175, 1568].forEach((f, i) => {
        const s = t + i * 0.16
        const g = envGain(ctx, out, s, 0.25, 0.01, 0.9)
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.value = f
        o.connect(g)
        o.start(s)
        o.stop(s + 1)
      })
      break
    }
  }
}
