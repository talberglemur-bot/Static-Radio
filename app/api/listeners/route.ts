import { and, desc, eq, gt, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { channel, listenerPresence, user } from '@/lib/db/schema'
import { errorResponse, requireAdmin } from '@/lib/session'

const PRESENCE_WINDOW_MS = 20_000

export type ActiveListener = {
  userId: string
  name: string
  email: string | null
  channelSlug: string
  channelName: string
  lastSeen: string
}

export async function GET() {
  try {
    await requireAdmin()
    const rows = await db
      .select({
        userId: listenerPresence.userId,
        userName: listenerPresence.userName,
        email: user.email,
        channelSlug: channel.slug,
        channelName: channel.name,
        lastSeen: listenerPresence.lastSeen,
      })
      .from(listenerPresence)
      .innerJoin(channel, eq(channel.id, listenerPresence.channelId))
      .leftJoin(user, eq(user.id, listenerPresence.userId))
      .where(
        and(
          isNotNull(listenerPresence.userId),
          gt(listenerPresence.lastSeen, new Date(Date.now() - PRESENCE_WINDOW_MS)),
        ),
      )
      .orderBy(desc(listenerPresence.lastSeen))

    // One row per account, even if they have several tabs open.
    const seen = new Set<string>()
    const listeners: ActiveListener[] = []
    for (const r of rows) {
      if (!r.userId || seen.has(r.userId)) continue
      seen.add(r.userId)
      listeners.push({
        userId: r.userId,
        name: r.userName ?? 'Ukjent',
        email: r.email,
        channelSlug: r.channelSlug,
        channelName: r.channelName,
        lastSeen: r.lastSeen.toISOString(),
      })
    }
    return Response.json({ listeners }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return errorResponse(err)
  }
}
