import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { channel, track } from '@/lib/db/schema'
import { ListenerApp } from '@/components/radio/listener-app'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await db
    .select({
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      frequency: channel.frequency,
      description: channel.description,
      isLive: channel.isLive,
      trackTitle: track.title,
      trackArtist: track.artist,
    })
    .from(channel)
    .leftJoin(track, eq(track.id, channel.currentTrackId))
    .orderBy(asc(channel.frequency))

  return <ListenerApp initialChannels={rows.map((r) => ({ ...r, isLive: false }))} />
}
