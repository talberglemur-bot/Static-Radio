import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { channel, queueItem, track } from '@/lib/db/schema'
import { errorResponse, requireStaff } from '@/lib/session'
import { publicTrack } from '@/lib/station'
import { removeFile } from '@/lib/storage'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff()
    const { id } = await params
    const body = await req.json()
    const patch: Partial<typeof track.$inferInsert> = {}
    if (typeof body.title === 'string' && body.title.trim())
      patch.title = body.title.trim().slice(0, 120)
    if (typeof body.artist === 'string' && body.artist.trim())
      patch.artist = body.artist.trim().slice(0, 120)
    if (body.kind === 'music' || body.kind === 'sfx' || body.kind === 'ad') patch.kind = body.kind
    const [updated] = await db
      .update(track)
      .set(patch)
      .where(eq(track.id, Number(id)))
      .returning()
    if (!updated) return Response.json({ error: 'Fant ikke' }, { status: 404 })
    return Response.json(publicTrack(updated))
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff()
    const { id } = await params
    const trackId = Number(id)
    const [removed] = await db.delete(track).where(eq(track.id, trackId)).returning()
    if (!removed) return Response.json({ error: 'Fant ikke' }, { status: 404 })
    await db.delete(queueItem).where(eq(queueItem.trackId, trackId))
    await db
      .update(channel)
      .set({ currentTrackId: null, startedAt: null, pausedAt: null })
      .where(eq(channel.currentTrackId, trackId))
    await removeFile({
      pathname: removed.pathname,
      access: removed.access as 'private' | 'public',
    })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
