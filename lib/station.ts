import { and, asc, desc, eq, gt, inArray, like, lt, ne, sql } from 'drizzle-orm'
import { buildAdTimeline, decodeAdItems, type AdSlot } from '@/lib/ad-catalog'
import { db } from '@/lib/db'
import {
  channel,
  listenerPresence,
  liveChunk,
  queueItem,
  relayStation,
  sfxEvent,
  songRequest,
  track,
} from '@/lib/db/schema'
import { removeFile } from '@/lib/storage'

export const LIVE_TIMEOUT_MS = 12_000
const PRESENCE_WINDOW_MS = 20_000
const MOVE_WINDOW_MS = 30_000

export type Channel = typeof channel.$inferSelect
export type Track = typeof track.$inferSelect

export function mediaUrl(kind: 'track' | 'chunk', id: number) {
  return `/api/media/${kind}/${id}`
}

export function publicTrack(t: Track) {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    durationSec: t.durationSec,
    kind: t.kind,
    src: mediaUrl('track', t.id),
  }
}

export async function getChannelBySlug(slug: string) {
  const [row] = await db.select().from(channel).where(eq(channel.slug, slug))
  return row ?? null
}

function positionSec(ch: Channel, now: number) {
  if (!ch.startedAt) return 0
  const end = ch.pausedAt ? ch.pausedAt.getTime() : now
  return Math.max(0, (end - ch.startedAt.getTime()) / 1000)
}

/**
 * Moves the channel onto its next track when the current one has finished
 * (or nothing is playing). Runs inside a row lock so concurrent listeners
 * polling at the same moment never double-advance.
 */
export async function advanceIfNeeded(channelId: number, force = false) {
  return db.transaction(async (tx) => {
    const [ch] = await tx
      .select()
      .from(channel)
      .where(eq(channel.id, channelId))
      .for('update')
    if (!ch) return null

    const now = Date.now()
    let current: Track | undefined
    if (ch.currentTrackId) {
      ;[current] = await tx
        .select()
        .from(track)
        .where(eq(track.id, ch.currentTrackId))
    }

    const finished =
      !current || (!ch.pausedAt && positionSec(ch, now) >= current.durationSec)
    if (!force && !finished) return ch
    if (!force && ch.pausedAt && current) return ch

    const [next] = await tx
      .select()
      .from(queueItem)
      .where(eq(queueItem.channelId, ch.id))
      .orderBy(desc(queueItem.priority), asc(queueItem.id))
      .limit(1)

    let nextTrackId: number | null = null
    if (next) {
      await tx.delete(queueItem).where(eq(queueItem.id, next.id))
      nextTrackId = next.trackId
      await tx
        .update(songRequest)
        .set({ status: 'played' })
        .where(and(eq(songRequest.trackId, next.trackId), eq(songRequest.status, 'queued')))
    } else if (ch.autoDj) {
      const [pick] = await tx
        .select({ id: track.id })
        .from(track)
        .where(
          and(
            eq(track.kind, 'music'),
            current ? ne(track.id, current.id) : undefined,
          ),
        )
        .orderBy(sql`random()`)
        .limit(1)
      nextTrackId = pick?.id ?? current?.id ?? null
    }

    const [updated] = await tx
      .update(channel)
      .set({
        currentTrackId: nextTrackId,
        startedAt: nextTrackId ? new Date(now) : null,
        pausedAt: null,
      })
      .where(eq(channel.id, ch.id))
      .returning()
    return updated
  })
}

export async function getStationState(
  slug: string,
  opts: {
    listenerId?: string
    listenerUser?: { id: string; name: string }
    sinceSfx?: number
    sinceChunk?: number
  },
) {
  const found = await getChannelBySlug(slug)
  if (!found) return null
  await endAdBreakIfDue(found)
  const ch = (await advanceIfNeeded(found.id)) ?? found
  const now = Date.now()

  if (opts.listenerId) {
    const userId = opts.listenerUser?.id ?? null
    const userName = opts.listenerUser?.name ?? null
    await db
      .insert(listenerPresence)
      .values({ listenerId: opts.listenerId, channelId: ch.id, userId, userName })
      .onConflictDoUpdate({
        target: listenerPresence.listenerId,
        set: { channelId: ch.id, userId, userName, lastSeen: new Date(now) },
      })
  }

  const [current] = ch.currentTrackId
    ? await db.select().from(track).where(eq(track.id, ch.currentTrackId))
    : []

  const upNext = await db
    .select({ queueId: queueItem.id, track })
    .from(queueItem)
    .innerJoin(track, eq(track.id, queueItem.trackId))
    .where(eq(queueItem.channelId, ch.id))
    .orderBy(desc(queueItem.priority), asc(queueItem.id))
    .limit(20)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listenerPresence)
    .where(
      and(
        eq(listenerPresence.channelId, ch.id),
        gt(listenerPresence.lastSeen, new Date(now - PRESENCE_WINDOW_MS)),
      ),
    )

  const [latestSfx] = await db
    .select({ id: sfxEvent.id })
    .from(sfxEvent)
    .where(eq(sfxEvent.channelId, ch.id))
    .orderBy(desc(sfxEvent.id))
    .limit(1)
  const [latestChunk] = await db
    .select({ id: liveChunk.id })
    .from(liveChunk)
    .where(eq(liveChunk.channelId, ch.id))
    .orderBy(desc(liveChunk.id))
    .limit(1)

  const recentCutoff = new Date(now - 15_000)
  // A cursor of -1 means "first poll": the client only wants the latest ids.
  const sfx =
    opts.sinceSfx !== undefined && opts.sinceSfx >= 0
      ? await db
          .select()
          .from(sfxEvent)
          .where(
            and(
              eq(sfxEvent.channelId, ch.id),
              gt(sfxEvent.id, opts.sinceSfx),
              gt(sfxEvent.createdAt, recentCutoff),
            ),
          )
          .orderBy(asc(sfxEvent.id))
          .limit(30)
      : []

  const chunks =
    opts.sinceChunk !== undefined && opts.sinceChunk >= 0
      ? await db
          .select({ id: liveChunk.id })
          .from(liveChunk)
          .where(
            and(
              eq(liveChunk.channelId, ch.id),
              gt(liveChunk.id, opts.sinceChunk),
              gt(liveChunk.createdAt, new Date(now - 30_000)),
            ),
          )
          .orderBy(asc(liveChunk.id))
          .limit(10)
      : []

  let adBreak: {
    id: number
    startedAt: number
    until: number
    slots: AdSlot[]
  } | null = null
  if (ch.adBreakUntil && ch.adBreakUntil.getTime() > now) {
    const [ev] = await db
      .select()
      .from(sfxEvent)
      .where(and(eq(sfxEvent.channelId, ch.id), like(sfxEvent.kind, 'ad:%')))
      .orderBy(desc(sfxEvent.id))
      .limit(1)
    if (ev) {
      const items = decodeAdItems(ev.kind)
      const ids = items.filter((i) => i.type === 'track').map((i) => Number(i.id))
      const adTracks = ids.length ? await db.select().from(track).where(inArray(track.id, ids)) : []
      adBreak = {
        id: ev.id,
        startedAt: ev.createdAt.getTime(),
        until: ch.adBreakUntil.getTime(),
        slots: buildAdTimeline(items, adTracks).slots,
      }
    }
  }

  let relay: { id: string; name: string; src: string } | null = null
  if (ch.relayUrl) {
    const [s] = await db.select().from(relayStation).where(eq(relayStation.id, ch.relayUrl))
    if (s) relay = { id: s.id, name: s.name, src: s.src }
  }

  // A move only affects people tuned in when it fires; it expires so latecomers stay put.
  const move =
    ch.moveToSlug && ch.moveAt && now - ch.moveAt.getTime() < MOVE_WINDOW_MS
      ? { to: ch.moveToSlug, at: ch.moveAt.getTime() }
      : null

  const isLive =
    ch.isLive &&
    !!ch.liveUpdatedAt &&
    now - ch.liveUpdatedAt.getTime() < LIVE_TIMEOUT_MS

  return {
    serverNow: now,
    channel: {
      id: ch.id,
      slug: ch.slug,
      name: ch.name,
      frequency: ch.frequency,
      description: ch.description,
      ticker: ch.ticker,
      musicVolume: ch.musicVolume,
      autoDj: ch.autoDj,
      paused: !!ch.pausedAt,
      relay,
    },
    nowPlaying: current
      ? {
          track: publicTrack(current),
          startedAt: ch.startedAt?.getTime() ?? now,
          paused: !!ch.pausedAt,
          positionSec: positionSec(ch, now),
        }
      : null,
    upNext: upNext.map((r) => ({ queueId: r.queueId, ...publicTrack(r.track) })),
    live: {
      isLive,
      host: isLive ? ch.liveHost : null,
      mode: (ch.liveMode === 'pause' ? 'pause' : 'duck') as 'pause' | 'duck',
    },
    adBreak,
    move,
    listeners: count,
    latestSfxId: latestSfx?.id ?? 0,
    latestChunkId: latestChunk?.id ?? 0,
    sfx: sfx.map((e) => ({
      id: e.id,
      kind: e.kind,
      src: e.trackId ? mediaUrl('track', e.trackId) : null,
    })),
    chunks: chunks.map((c) => ({ id: c.id, src: mediaUrl('chunk', c.id) })),
  }
}

export type StationState = NonNullable<Awaited<ReturnType<typeof getStationState>>>

/** Unpauses the programme, shifting the clock so the track continues where it stopped. */
export async function resumeChannel(ch: Channel, extra: Partial<typeof channel.$inferInsert> = {}) {
  const now = Date.now()
  const patch: Partial<typeof channel.$inferInsert> = { ...extra }
  if (ch.pausedAt && ch.startedAt) {
    patch.pausedAt = null
    patch.startedAt = new Date(ch.startedAt.getTime() + (now - ch.pausedAt.getTime()))
  }
  if (Object.keys(patch).length) await db.update(channel).set(patch).where(eq(channel.id, ch.id))
}

async function endAdBreakIfDue(ch: Channel) {
  if (!ch.adBreakUntil || ch.adBreakUntil.getTime() > Date.now()) return
  // Only one poller wins the clear, so the programme is resumed exactly once.
  const [claimed] = await db
    .update(channel)
    .set({ adBreakUntil: null })
    .where(and(eq(channel.id, ch.id), eq(channel.adBreakUntil, ch.adBreakUntil)))
    .returning({ id: channel.id })
  if (!claimed) return
  const live = ch.isLive && ch.liveMode === 'pause'
  if (!live) await resumeChannel(ch)
}

export async function pruneOldChunks(channelId: number) {
  const old = await db
    .delete(liveChunk)
    .where(
      and(
        eq(liveChunk.channelId, channelId),
        lt(liveChunk.createdAt, new Date(Date.now() - 5 * 60_000)),
      ),
    )
    .returning()
  await Promise.all(
    old.map((c) =>
      removeFile({ pathname: c.pathname, access: c.access as 'private' | 'public' }),
    ),
  )
}
