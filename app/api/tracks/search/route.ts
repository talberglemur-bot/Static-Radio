import { db } from '@/lib/db'
import { queueItem } from '@/lib/db/schema'
import { errorResponse, requireStaff } from '@/lib/session'
import { getChannelBySlug } from '@/lib/station'
import { importItunesSong, searchSongs } from '@/lib/song-finder'

export const maxDuration = 60

export async function GET(req: Request) {
  try {
    await requireStaff()
    const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 100) ?? ''
    if (q.length < 2) return Response.json([])
    const hits = await searchSongs(q)
    return Response.json(hits, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: Request) {
  try {
    const staff = await requireStaff()
    const { itunesId, queueSlug } = await req.json()
    const id = Number(itunesId)
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: 'Ugyldig låt' }, { status: 400 })
    }
    const song = await importItunesSong(id, staff.id)
    let queuedOn: string | null = null
    if (queueSlug) {
      const ch = await getChannelBySlug(String(queueSlug))
      if (ch) {
        await db.insert(queueItem).values({ channelId: ch.id, trackId: song.trackId, priority: 1 })
        queuedOn = ch.name
      }
    }
    return Response.json({ ok: true, song, queuedOn })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Fant ikke')) {
      return Response.json({ error: 'Fant ikke låta på nettet' }, { status: 404 })
    }
    return errorResponse(err)
  }
}
