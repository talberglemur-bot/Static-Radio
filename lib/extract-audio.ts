import { Mp3Encoder } from '@breezystack/lamejs'

const VIDEO_EXT = new Set(['mov', 'mp4', 'm4v', '3gp', 'avi', 'mkv', 'webm'])
const MAX_VIDEO_BYTES = 600 * 1024 * 1024
const CHUNK = 1152 * 40

export function isVideoFile(file: File) {
  if (file.type.startsWith('video/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return VIDEO_EXT.has(ext) && !file.type.startsWith('audio/')
}

function toInt16(data: Float32Array, start: number, end: number) {
  const out = new Int16Array(end - start)
  for (let i = start; i < end; i++) {
    const s = Math.max(-1, Math.min(1, data[i]))
    out[i - start] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0))

// Pulls the soundtrack out of a phone video and re-encodes it as a compact MP3,
// so listeners stream a few MB of audio instead of the whole video file.
export async function extractAudioAsMp3(file: File, onProgress: (pct: number) => void) {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Videoen er for stor (maks 600 MB). Klipp den kortere eller bruk en lydfil.')
  }
  const Ctx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  let audio: AudioBuffer
  try {
    audio = await ctx.decodeAudioData(await file.arrayBuffer())
  } catch {
    throw new Error('Fant ingen lyd i videoen, eller formatet støttes ikke')
  } finally {
    ctx.close().catch(() => {})
  }

  const stereo = audio.numberOfChannels > 1
  const left = audio.getChannelData(0)
  const right = stereo ? audio.getChannelData(1) : undefined
  const encoder = new Mp3Encoder(stereo ? 2 : 1, audio.sampleRate, 160)
  const parts: Uint8Array[] = []

  for (let i = 0; i < left.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, left.length)
    const mp3 = right ? encoder.encodeBuffer(toInt16(left, i, end), toInt16(right, i, end)) : encoder.encodeBuffer(toInt16(left, i, end))
    if (mp3.length) parts.push(mp3)
    if ((i / CHUNK) % 20 === 0) {
      onProgress((end / left.length) * 100)
      await nextFrame()
    }
  }
  const tail = encoder.flush()
  if (tail.length) parts.push(tail)
  onProgress(100)

  const name = file.name.replace(/\.[^.]+$/, '') + '.mp3'
  const out = new File(parts as BlobPart[], name, { type: 'audio/mpeg' })
  if (out.size < 1024) {
    throw new Error('Videoen har ingen hørbar lyd')
  }
  // iOS Safari sometimes reports duration as 0/NaN for decoded video audio.
  const candidates = [audio.duration, audio.length / audio.sampleRate, (out.size * 8) / 160_000]
  const durationSec = candidates.find((d) => Number.isFinite(d) && d > 0.5) ?? 1
  return { file: out, durationSec }
}
