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
    case 'scratch': {
      const buf = noiseBuffer(ctx, 0.2)
      ;[0, 0.16, 0.26, 0.42].forEach((offset, i) => {
        const s = t + offset
        const src = ctx.createBufferSource()
        src.buffer = buf
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 4
        const up = i % 2 === 0
        bp.frequency.setValueAtTime(up ? 500 : 2500, s)
        bp.frequency.exponentialRampToValueAtTime(up ? 2500 : 500, s + 0.13)
        const g = envGain(ctx, out, s, 0.8, 0.01, 0.13)
        src.connect(bp).connect(g)
        src.start(s)
        src.stop(s + 0.16)
      })
      break
    }
    case 'boom': {
      const g = envGain(ctx, out, t, 0.9, 0.005, 2)
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(90, t)
      o.frequency.exponentialRampToValueAtTime(28, t + 1.5)
      o.connect(g)
      o.start(t)
      o.stop(t + 2.1)
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx, 1.5)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(1800, t)
      lp.frequency.exponentialRampToValueAtTime(120, t + 1.4)
      const ng = envGain(ctx, out, t, 0.6, 0.005, 1.4)
      src.connect(lp).connect(ng)
      src.start(t)
      break
    }
    case 'whoosh': {
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx, 1)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1.5
      bp.frequency.setValueAtTime(200, t)
      bp.frequency.exponentialRampToValueAtTime(5000, t + 0.6)
      const pan = ctx.createStereoPanner()
      pan.pan.setValueAtTime(-1, t)
      pan.pan.linearRampToValueAtTime(1, t + 0.8)
      const g = envGain(ctx, out, t, 0.7, 0.4, 0.45)
      src.connect(bp).connect(pan).connect(g)
      src.start(t)
      src.stop(t + 1)
      break
    }
    case 'sad': {
      ;[392, 370, 349, 330].forEach((f, i) => {
        const s = t + i * 0.42
        const len = i === 3 ? 1.1 : 0.36
        const g = envGain(ctx, out, s, 0.25, 0.03, len)
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f, s)
        if (i === 3) {
          const lfo = ctx.createOscillator()
          lfo.frequency.value = 6
          const depth = ctx.createGain()
          depth.gain.value = 8
          lfo.connect(depth).connect(o.frequency)
          lfo.start(s)
          lfo.stop(s + len + 0.1)
        }
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 1400
        o.connect(lp).connect(g)
        o.start(s)
        o.stop(s + len + 0.1)
      })
      break
    }
    case 'cowbell': {
      for (let i = 0; i < 4; i++) {
        const s = t + i * 0.25
        const g = envGain(ctx, out, s, 0.3, 0.002, 0.3)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 800
        bp.Q.value = 2
        bp.connect(g)
        ;[540, 800].forEach((f) => {
          const o = ctx.createOscillator()
          o.type = 'square'
          o.frequency.value = f
          o.connect(bp)
          o.start(s)
          o.stop(s + 0.32)
        })
      }
      break
    }
    case 'glitch': {
      for (let i = 0; i < 14; i++) {
        const s = t + i * 0.06
        const g = envGain(ctx, out, s, 0.22, 0.002, 0.05)
        const o = ctx.createOscillator()
        o.type = Math.random() > 0.5 ? 'square' : 'sawtooth'
        o.frequency.value = 80 + Math.random() * 2400
        o.connect(g)
        o.start(s)
        o.stop(s + 0.06)
      }
      break
    }
    case 'vinylstop': {
      const g = envGain(ctx, out, t, 0.35, 0.01, 1.1)
      ;[220, 330].forEach((f) => {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f, t)
        o.frequency.exponentialRampToValueAtTime(18, t + 1.1)
        o.connect(g)
        o.start(t)
        o.stop(t + 1.15)
      })
      break
    }
    case 'coin': {
      ;[988, 1319].forEach((f, i) => {
        const s = t + i * 0.08
        const g = envGain(ctx, out, s, 0.22, 0.003, i ? 0.45 : 0.08)
        const o = ctx.createOscillator()
        o.type = 'square'
        o.frequency.value = f
        o.connect(g)
        o.start(s)
        o.stop(s + 0.5)
      })
      break
    }
  }
}
