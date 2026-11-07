import { db } from '@/lib/db'
import { sfxEvent } from '@/lib/db/schema'
import { getChannelBySlug } from '@/lib/station'
import { REACTIONS } from '@/lib/sfx-catalog'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const ch = await getChannelBySlug(slug)
  if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
  const { reaction } = await req.json().catch(() => ({}))
  if (!REACTIONS.includes(reaction)) {
    return Response.json({ error: 'Ukjent reaksjon' }, { status: 400 })
  }
  await db.insert(sfxEvent).values({ channelId: ch.id, kind: `react:${reaction}` })
  return Response.json({ ok: true })
}
