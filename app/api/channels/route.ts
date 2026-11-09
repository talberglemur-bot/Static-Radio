import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { channel, relayStation, track } from '@/lib/db/schema'
import { errorResponse, requireAdmin } from '@/lib/session'

export async function GET() {
  const rows = await db
    .select({
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      frequency: channel.frequency,
      description: channel.description,
      isLive: channel.isLive,
      liveUpdatedAt: channel.liveUpdatedAt,
      closedAt: channel.closedAt,
      trackTitle: track.title,
      trackArtist: track.artist,
      relayName: relayStation.name,
    })
    .from(channel)
    .leftJoin(track, eq(track.id, channel.currentTrackId))
    .leftJoin(relayStation, eq(relayStation.id, channel.relayUrl))
    .orderBy(asc(channel.frequency))
  const now = Date.now()
  return Response.json(
    rows.map(({ liveUpdatedAt, closedAt, ...r }) => ({
      ...r,
      trackTitle: r.relayName ? null : r.trackTitle,
      trackArtist: r.relayName ? null : r.trackArtist,
      isClosed: !!closedAt && closedAt.getTime() <= now,
      isLive: r.isLive && !!liveUpdatedAt && now - liveUpdatedAt.getTime() < 12_000,
    })),
  )
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const name = String(body.name ?? '').trim().slice(0, 40)
    const frequency = String(body.frequency ?? '').trim()
    const description = String(body.description ?? '').trim().slice(0, 140)
    const freq = Number(frequency)
    if (!name || !Number.isFinite(freq) || freq < 87.5 || freq > 108) {
      return Response.json(
        { error: 'Navn og en frekvens mellom 87,5 og 108,0 er påkrevd' },
        { status: 400 },
      )
    }
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `ch-${Date.now()}`
    const [created] = await db
      .insert(channel)
      .values({ name, frequency: freq.toFixed(1), description, slug })
      .onConflictDoNothing()
      .returning()
    if (!created) {
      return Response.json({ error: 'Det finnes allerede en kanal med det navnet' }, { status: 409 })
    }
    return Response.json(created)
  } catch (err) {
    return errorResponse(err)
  }
}
