import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { channel, liveChunk } from '@/lib/db/schema'
import { errorResponse, requireStaff } from '@/lib/session'
import { getChannelBySlug, pruneOldChunks } from '@/lib/station'
import { storeFile } from '@/lib/storage'

const MAX_CHUNK_BYTES = 2 * 1024 * 1024

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const staff = await requireStaff()
    const { slug } = await params
    const ch = await getChannelBySlug(slug)
    if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })

    const form = await req.formData()
    const file = form.get('chunk')
    if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_CHUNK_BYTES) {
      return Response.json({ error: 'Ugyldig lydsegment' }, { status: 400 })
    }
    const type = file.type || 'audio/webm'
    if (!type.startsWith('audio/')) {
      return Response.json({ error: 'Kun lyd' }, { status: 400 })
    }
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
    const stored = await storeFile(`live/${ch.slug}/chunk.${ext}`, file, type)

    await db.insert(liveChunk).values({ channelId: ch.id, ...stored })
    await db
      .update(channel)
      .set({ isLive: true, liveHost: staff.name, liveUpdatedAt: new Date() })
      .where(eq(channel.id, ch.id))

    if (Math.random() < 0.1) await pruneOldChunks(ch.id)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
