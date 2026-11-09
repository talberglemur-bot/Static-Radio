import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { channel, relayStation } from '@/lib/db/schema'
import { errorResponse, requireStaff } from '@/lib/session'
import { normalizeStreamUrl } from '@/lib/nrk-streams'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff()
    const { id } = await params
    const body = (await req.json()) as { name?: string; url?: string }
    const patch: Partial<typeof relayStation.$inferInsert> = {}
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 40)
    if (typeof body.url === 'string') {
      const src = normalizeStreamUrl(body.url)
      if (!src) return Response.json({ error: 'Ugyldig lenke. Bruk en https-lenke.' }, { status: 400 })
      patch.src = src
    }
    if (!Object.keys(patch).length) return Response.json({ error: 'Ingenting å lagre' }, { status: 400 })
    const [row] = await db.update(relayStation).set(patch).where(eq(relayStation.id, id)).returning()
    if (!row) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
    return Response.json({ station: { id: row.id, name: row.name, src: row.src } })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff()
    const { id } = await params
    await db.update(channel).set({ relayUrl: null }).where(eq(channel.relayUrl, id))
    await db.delete(relayStation).where(eq(relayStation.id, id))
    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
