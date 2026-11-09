import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { channel, track } from '@/lib/db/schema'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { ListenerApp } from '@/components/radio/listener-app'

export const dynamic = 'force-dynamic'

export default async function Page() {
  if (!(await getSessionUser())) redirect('/sign-in')
  const rows = await db
    .select({
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      frequency: channel.frequency,
      description: channel.description,
      isLive: channel.isLive,
      closedAt: channel.closedAt,
      trackTitle: track.title,
      trackArtist: track.artist,
    })
    .from(channel)
    .leftJoin(track, eq(track.id, channel.currentTrackId))
    .orderBy(asc(channel.frequency))

  const now = Date.now()
  return (
    <ListenerApp
      initialChannels={rows.map(({ closedAt, ...r }) => ({
        ...r,
        isLive: false,
        isClosed: !!closedAt && closedAt.getTime() <= now,
      }))}
    />
  )
}
