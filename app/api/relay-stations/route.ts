import { asc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { relayStation } from '@/lib/db/schema'
import { errorResponse, requireStaff } from '@/lib/session'
import { guessStreamName, normalizeStreamUrl } from '@/lib/nrk-streams'

export async function GET() {
  try {
    await requireStaff()
    const rows = await db.select().from(relayStation).orderBy(asc(relayStation.sort), asc(relayStation.createdAt))
    return Response.json({ stations: rows.map(({ id, name, src }) => ({ id, name, src })) })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff()
    const body = (await req.json()) as { name?: string; url?: string }
    const src = normalizeStreamUrl(String(body.url ?? ''))
    if (!src) return Response.json({ error: 'Ugyldig lenke. Bruk en https-lenke.' }, { status: 400 })
    const name = (String(body.name ?? '').trim() || guessStreamName(String(body.url))).slice(0, 40)
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${relayStation.sort}), 0)` }).from(relayStation)
    const id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    await db.insert(relayStation).values({ id, name, src, sort: Number(max) + 1 })
    return Response.json({ station: { id, name, src } })
  } catch (e) {
    return errorResponse(e)
  }
}
