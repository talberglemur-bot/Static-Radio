import { and, eq, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { track } from '@/lib/db/schema'
import { storeFile } from '@/lib/storage'

type ItunesSong = {
  trackName: string
  artistName: string
  previewUrl?: string
  trackTimeMillis?: number
}

export type FoundSong = { trackId: number; title: string; artist: string; reused: boolean }

const PREVIEW_SECONDS = 30

function normalise(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function words(s: string) {
  return normalise(s)
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w))
}

function overlap(a: string, b: string) {
  const wa = words(a)
  const wb = new Set(words(b))
  if (!wa.length) return 0
  return wa.filter((w) => wb.has(w)).length / wa.length
}

function matchScore(song: ItunesSong, artist: string, title: string) {
  const artistScore = overlap(artist, song.artistName)
  const titleScore = overlap(title, song.trackName)
  const live = /\b(live|remix|karaoke|instrumental)\b/i.test(song.trackName) ? 0.15 : 0
  return artistScore * 0.6 + titleScore * 0.4 - live
}

async function searchItunes(artist: string, title: string): Promise<ItunesSong | null> {
  const term = encodeURIComponent(`${artist} ${title}`)
  for (const country of ['NO', 'US']) {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=10&country=${country}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) },
    )
    if (!res.ok) continue
    const json = (await res.json()) as { results?: ItunesSong[] }
    const songs = (json.results ?? []).filter((s) => s.previewUrl)
    if (!songs.length) continue
    const best = songs
      .map((s, i) => ({ s, score: matchScore(s, artist, title) - i * 0.01 }))
      .sort((x, y) => y.score - x.score)[0]
    if (best && best.score > 0.3) return best.s
  }
  return null
}

export async function findOrImportSong(
  artist: string,
  title: string,
  userId: string,
): Promise<FoundSong> {
  const [existing] = await db
    .select()
    .from(track)
    .where(and(eq(track.kind, 'music'), ilike(track.artist, artist), ilike(track.title, title)))
    .limit(1)
  if (existing) {
    return { trackId: existing.id, title: existing.title, artist: existing.artist, reused: true }
  }

  const song = await searchItunes(artist, title)
  if (!song?.previewUrl) throw new Error(`Fant ikke «${artist} – ${title}» på nettet`)

  const audio = await fetch(song.previewUrl, { signal: AbortSignal.timeout(20_000) })
  if (!audio.ok) throw new Error('Kunne ikke laste ned låta')
  const buf = Buffer.from(await audio.arrayBuffer())
  const safe = normalise(`${song.artistName} ${song.trackName}`).replace(/\s+/g, '-').slice(0, 60)
  const stored = await storeFile(`tracks/${safe || 'request'}.m4a`, buf, 'audio/mp4')

  const [created] = await db
    .insert(track)
    .values({
      title: song.trackName.slice(0, 120),
      artist: song.artistName.slice(0, 120),
      kind: 'music',
      durationSec: PREVIEW_SECONDS,
      userId,
      ...stored,
    })
    .returning()
  return { trackId: created.id, title: created.title, artist: created.artist, reused: false }
}
