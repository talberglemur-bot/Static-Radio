import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chatMessage } from '@/lib/db/schema'
import { errorResponse, isStaff, requireStaff, requireUser } from '@/lib/session'
import { getChannelBySlug } from '@/lib/station'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const ch = await getChannelBySlug(slug)
  if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
  const rows = await db
    .select({
      id: chatMessage.id,
      userName: chatMessage.userName,
      body: chatMessage.body,
      isStaff: chatMessage.isStaff,
      createdAt: chatMessage.createdAt,
    })
    .from(chatMessage)
    .where(eq(chatMessage.channelId, ch.id))
    .orderBy(desc(chatMessage.id))
    .limit(60)
  return Response.json(rows.reverse(), { headers: { 'Cache-Control': 'no-store' } })
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
    const text = String(body ?? '').trim().slice(0, 280)
    if (!text) return Response.json({ error: 'Meldingen er tom' }, { status: 400 })

    const [recent] = await db
      .select({ id: chatMessage.id })
      .from(chatMessage)
      .where(
        and(
          eq(chatMessage.userId, u.id),
          gt(chatMessage.createdAt, new Date(Date.now() - 1500)),
        ),
      )
      .limit(1)
    if (recent) return Response.json({ error: 'Ro ned litt' }, { status: 429 })

    await db.insert(chatMessage).values({
      channelId: ch.id,
      userId: u.id,
      userName: u.name,
      body: text,
      isStaff: isStaff(u),
    })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireStaff()
    const { slug } = await params
    const ch = await getChannelBySlug(slug)
    if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
    const { id } = await req.json()
    await db
      .delete(chatMessage)
      .where(and(eq(chatMessage.id, Number(id)), eq(chatMessage.channelId, ch.id)))
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
