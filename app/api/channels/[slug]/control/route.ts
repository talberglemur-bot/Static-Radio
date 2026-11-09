import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { channel, queueItem, relayStation, sfxEvent, track } from '@/lib/db/schema'
import { errorResponse, requireStaff } from '@/lib/session'
import { advanceIfNeeded, getChannelBySlug, resumeChannel } from '@/lib/station'
import { BUILT_IN_SFX } from '@/lib/sfx-catalog'
import { buildAdTimeline, decodeAdItems, encodeAdItems, type AdItem } from '@/lib/ad-catalog'

type Action =
  | { type: 'play'; trackId: number }
  | { type: 'enqueue'; trackId: number }
  | { type: 'dequeue'; queueId: number }
  | { type: 'skip' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'seek'; positionSec: number }
  | { type: 'volume'; value: number }
  | { type: 'autoDj'; value: boolean }
  | { type: 'relay'; streamId: string | null }
  | { type: 'details'; name?: string; description?: string; ticker?: string }
  | { type: 'sfx'; kind?: string; trackId?: number }
  | { type: 'live'; on: boolean; mode?: 'duck' | 'pause' }
  | { type: 'adBreak'; items: AdItem[] }
  | { type: 'endAdBreak' }
  | { type: 'moveListeners'; to: string; delaySec?: number }
  | { type: 'closeChannel'; to: string; delaySec?: number }
  | { type: 'cancelMove' }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const staff = await requireStaff()
    const { slug } = await params
    const ch = await getChannelBySlug(slug)
    if (!ch) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
    const action = (await req.json()) as Action
    const now = new Date()

    switch (action.type) {
      case 'play': {
        const [t] = await db.select().from(track).where(eq(track.id, Number(action.trackId)))
        if (!t) return Response.json({ error: 'Fant ikke sporet' }, { status: 404 })
        await db
          .update(channel)
          .set({ currentTrackId: t.id, startedAt: now, pausedAt: null })
          .where(eq(channel.id, ch.id))
        break
      }
      case 'enqueue': {
        const [t] = await db.select().from(track).where(eq(track.id, Number(action.trackId)))
        if (!t) return Response.json({ error: 'Fant ikke sporet' }, { status: 404 })
        await db.insert(queueItem).values({ channelId: ch.id, trackId: t.id })
        break
      }
      case 'dequeue':
        await db
          .delete(queueItem)
          .where(and(eq(queueItem.id, Number(action.queueId)), eq(queueItem.channelId, ch.id)))
        break
      case 'skip':
        await advanceIfNeeded(ch.id, true)
        break
      case 'pause':
        if (!ch.pausedAt) {
          await db.update(channel).set({ pausedAt: now }).where(eq(channel.id, ch.id))
        }
        break
      case 'resume':
        if (ch.pausedAt && ch.startedAt) {
          const shift = now.getTime() - ch.pausedAt.getTime()
          await db
            .update(channel)
            .set({ pausedAt: null, startedAt: new Date(ch.startedAt.getTime() + shift) })
            .where(eq(channel.id, ch.id))
        } else if (ch.pausedAt) {
          await db.update(channel).set({ pausedAt: null }).where(eq(channel.id, ch.id))
        }
        break
      case 'restart':
        await db
          .update(channel)
          .set({ startedAt: now, pausedAt: ch.pausedAt ? now : null })
          .where(eq(channel.id, ch.id))
        break
      case 'seek': {
        const pos = Math.max(0, Number(action.positionSec) || 0)
        const ref = ch.pausedAt ?? now
        await db
          .update(channel)
          .set({ startedAt: new Date(ref.getTime() - pos * 1000) })
          .where(eq(channel.id, ch.id))
        break
      }
      case 'volume':
        await db
          .update(channel)
          .set({ musicVolume: Math.min(1, Math.max(0, Number(action.value))) })
          .where(eq(channel.id, ch.id))
        break
      case 'autoDj':
        await db.update(channel).set({ autoDj: !!action.value }).where(eq(channel.id, ch.id))
        break
      case 'relay': {
        let id: string | null = null
        if (action.streamId) {
          const [s] = await db.select().from(relayStation).where(eq(relayStation.id, String(action.streamId)))
          if (!s) return Response.json({ error: 'Fant ikke NRK-kanalen' }, { status: 404 })
          id = s.id
        }
        await db.update(channel).set({ relayUrl: id }).where(eq(channel.id, ch.id))
        break
      }
      case 'details': {
        const patch: Partial<typeof channel.$inferInsert> = {}
        if (typeof action.name === 'string' && action.name.trim())
          patch.name = action.name.trim().slice(0, 40)
        if (typeof action.description === 'string')
          patch.description = action.description.trim().slice(0, 140)
        if (typeof action.ticker === 'string') patch.ticker = action.ticker.trim().slice(0, 200)
        if (Object.keys(patch).length) {
          await db.update(channel).set(patch).where(eq(channel.id, ch.id))
        }
        break
      }
      case 'sfx': {
        if (action.trackId) {
          const [t] = await db
            .select()
            .from(track)
            .where(and(eq(track.id, Number(action.trackId)), eq(track.kind, 'sfx')))
          if (!t) return Response.json({ error: 'Fant ikke lyden' }, { status: 404 })
          await db.insert(sfxEvent).values({ channelId: ch.id, kind: 'custom', trackId: t.id })
        } else if (action.kind && BUILT_IN_SFX.some((s) => s.kind === action.kind)) {
          await db.insert(sfxEvent).values({ channelId: ch.id, kind: action.kind })
        } else {
          return Response.json({ error: 'Ukjent lyd' }, { status: 400 })
        }
        break
      }
      case 'live': {
        const mode = action.mode === 'pause' ? 'pause' : 'duck'
        if (action.on) {
          await db
            .update(channel)
            .set({
              isLive: true,
              liveHost: staff.name,
              liveUpdatedAt: now,
              liveMode: mode,
              pausedAt: mode === 'pause' ? (ch.pausedAt ?? now) : ch.pausedAt,
            })
            .where(eq(channel.id, ch.id))
        } else {
          const wasPauseMode = ch.liveMode === 'pause'
          const off = { isLive: false, liveHost: null, liveUpdatedAt: now, liveMode: 'duck' }
          if (wasPauseMode && !ch.adBreakUntil) await resumeChannel(ch, off)
          else await db.update(channel).set(off).where(eq(channel.id, ch.id))
        }
        break
      }
      case 'adBreak': {
        const items = decodeAdItems(encodeAdItems(Array.isArray(action.items) ? action.items.slice(0, 6) : []))
        if (!items.length) return Response.json({ error: 'Velg minst én reklame' }, { status: 400 })
        const trackIds = items.filter((i) => i.type === 'track').map((i) => Number(i.id))
        const adTracks = trackIds.length
          ? await db.select().from(track).where(inArray(track.id, trackIds))
          : []
        if (adTracks.length !== trackIds.length)
          return Response.json({ error: 'Fant ikke reklamefilen' }, { status: 404 })
        const { slots, totalSec: seconds } = buildAdTimeline(items, adTracks)
        if (!slots.length) return Response.json({ error: 'Velg minst én reklame' }, { status: 400 })
        await db
          .update(channel)
          .set({
            adBreakUntil: new Date(now.getTime() + seconds * 1000),
            pausedAt: ch.pausedAt ?? (ch.startedAt ? now : null),
          })
          .where(eq(channel.id, ch.id))
        await db.insert(sfxEvent).values({ channelId: ch.id, kind: encodeAdItems(items) })
        break
      }
      case 'endAdBreak':
        if (ch.adBreakUntil) {
          await db.insert(sfxEvent).values({ channelId: ch.id, kind: 'ad-stop' })
          await resumeChannel(ch, { adBreakUntil: null })
        }
        break
      case 'moveListeners':
      case 'closeChannel': {
        const target = await getChannelBySlug(String(action.to ?? ''))
        if (!target || target.id === ch.id)
          return Response.json({ error: 'Velg en annen kanal' }, { status: 400 })
        if (target.closedAt && target.closedAt.getTime() <= now.getTime())
          return Response.json({ error: 'Kan ikke flytte til en stengt kanal' }, { status: 400 })
        const delay = Math.min(24 * 3600, Math.max(0, Math.round(Number(action.delaySec) || 0)))
        const at = new Date(now.getTime() + delay * 1000)
        await db
          .update(channel)
          .set({
            moveToSlug: target.slug,
            moveAt: at,
            ...(action.type === 'closeChannel' ? { closedAt: at } : {}),
          })
          .where(eq(channel.id, ch.id))
        break
      }
      case 'cancelMove':
        await db
          .update(channel)
          .set({ moveToSlug: null, moveAt: null, closedAt: null })
          .where(eq(channel.id, ch.id))
        break
      default:
        return Response.json({ error: 'Ukjent handling' }, { status: 400 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
