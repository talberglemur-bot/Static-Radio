import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { queueItem, songRequest } from '@/lib/db/schema'
import {
  errorResponse,
  getSessionUser,
  isStaff,
  requireStaff,
  requireUser,
} from '@/lib/session'
import { getChannelBySlug } from '@/lib/station'
import { findOrImportSong } from '@/lib/song-finder'

export const maxDuration = 60

const STATUSES = ['pending', 'queued', 'played', 'declined'] as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const noStore = { headers: { 'Cache-Control': 'no-store' } }
  const { slug } = await params
  const ch = await getChannelBySlug(slug)
  if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
  const u = await getSessionUser()
  if (!u) return Response.json([], noStore)
  // Listeners only ever see their own wishes; the studio sees everything.
  const scope = isStaff(u)
    ? eq(songRequest.channelId, ch.id)
    : and(eq(songRequest.channelId, ch.id), eq(songRequest.userId, u.id))
  const rows = await db
    .select({
      id: songRequest.id,
      userName: songRequest.userName,
      body: songRequest.body,
      artist: songRequest.artist,
      title: songRequest.title,
      status: songRequest.status,
      createdAt: songRequest.createdAt,
    })
    .from(songRequest)
    .where(scope)
    .orderBy(desc(songRequest.id))
    .limit(40)
  return Response.json(rows, noStore)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const u = await requireUser()
    const { slug } = await params
    const ch = await getChannelBySlug(slug)
    if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
    const json = await req.json().catch(() => ({}))
    const id = json?.id != null ? Number(json.id) : null
    if (id !== null && !Number.isInteger(id)) {
      return Response.json({ error: 'Ugyldig ønske' }, { status: 400 })
    }

    const conditions = [eq(songRequest.channelId, ch.id)]
    if (!isStaff(u)) conditions.push(eq(songRequest.userId, u.id))
    if (id !== null) conditions.push(eq(songRequest.id, id))

    const deleted = await db
      .delete(songRequest)
      .where(and(...conditions))
      .returning({ id: songRequest.id })
    return Response.json({ ok: true, cleared: deleted.length })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const u = await requireUser()
    const { slug } = await params
    const ch = await getChannelBySlug(slug)
    if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
    const json = await req.json()
    let artist = String(json.artist ?? json.body ?? '').trim()
    let title = String(json.title ?? '').trim()
    if (!title) {
      const [a, ...rest] = artist.split(/\s*[-–—]\s+|\s+[-–—]\s*/)
      if (rest.length) {
        artist = a.trim()
        title = rest.join(' - ').trim()
      }
    }
    artist = artist.slice(0, 80)
    title = title.slice(0, 80)
    if (!artist || !title) {
      return Response.json({ error: 'Skriv både artist og låttittel' }, { status: 400 })
    }

    const [recent] = await db
      .select({ id: songRequest.id })
      .from(songRequest)
      .where(
        and(
          eq(songRequest.userId, u.id),
          gt(songRequest.createdAt, new Date(Date.now() - 60_000)),
        ),
      )
      .limit(1)
    if (recent) {
      return Response.json({ error: 'Ett ønske per minutt, takk' }, { status: 429 })
    }

    await db.insert(songRequest).values({
      channelId: ch.id,
      userId: u.id,
      userName: u.name,
      body: `${artist} – ${title}`,
      artist,
      title,
    })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const staff = await requireStaff()
    const { slug } = await params
    const ch = await getChannelBySlug(slug)
    if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
    const { id, status, accept, targetSlug } = await req.json()

    const [request] = await db
      .select()
      .from(songRequest)
      .where(and(eq(songRequest.id, Number(id)), eq(songRequest.channelId, ch.id)))
    if (!request) return Response.json({ error: 'Fant ikke ønsket' }, { status: 404 })

    if (accept) {
      const target = targetSlug ? await getChannelBySlug(String(targetSlug)) : ch
      if (!target) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
      let artist = request.artist
      let title = request.title
      if (!artist || !title) {
        const [a, ...rest] = request.body.split(/\s[-–]\s/)
        artist = a?.trim() || request.body
        title = rest.join(' - ').trim() || request.body
      }
      const song = await findOrImportSong(artist, title, staff.id)
      await db.insert(queueItem).values({ channelId: target.id, trackId: song.trackId, priority: 1 })
      await db
        .update(songRequest)
        .set({ status: 'queued', trackId: song.trackId })
        .where(eq(songRequest.id, request.id))
      return Response.json({ ok: true, song, channel: target.name })
    }

    if (!STATUSES.includes(status)) {
      return Response.json({ error: 'Ugyldig status' }, { status: 400 })
    }
    await db.update(songRequest).set({ status }).where(eq(songRequest.id, request.id))
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Fant ikke «')) {
      return Response.json({ error: err.message }, { status: 404 })
    }
    return errorResponse(err)
  }
}
