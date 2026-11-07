import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { songRequest } from '@/lib/db/schema'
import { errorResponse, requireStaff, requireUser } from '@/lib/session'
import { getChannelBySlug } from '@/lib/station'

const STATUSES = ['pending', 'queued', 'played', 'declined'] as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const ch = await getChannelBySlug(slug)
  if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
  const rows = await db
    .select({
      id: songRequest.id,
      userName: songRequest.userName,
      body: songRequest.body,
      status: songRequest.status,
      createdAt: songRequest.createdAt,
    })
    .from(songRequest)
    .where(eq(songRequest.channelId, ch.id))
    .orderBy(desc(songRequest.id))
    .limit(40)
  return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } })
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
    const { body } = await req.json()
    const text = String(body ?? '').trim().slice(0, 160)
    if (!text) return Response.json({ error: 'Fortell oss hva vi skal spille' }, { status: 400 })

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

    await db
      .insert(songRequest)
      .values({ channelId: ch.id, userId: u.id, userName: u.name, body: text })
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
    await requireStaff()
    const { slug } = await params
    const ch = await getChannelBySlug(slug)
    if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
    const { id, status } = await req.json()
    if (!STATUSES.includes(status)) {
      return Response.json({ error: 'Ugyldig status' }, { status: 400 })
    }
    await db
      .update(songRequest)
      .set({ status })
      .where(and(eq(songRequest.id, Number(id)), eq(songRequest.channelId, ch.id)))
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
