import type { NextRequest } from 'next/server'
import { getStationState } from '@/lib/station'
import { errorResponse, requireUser } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const me = await requireUser()
    const { slug } = await params
    const sp = req.nextUrl.searchParams
    const listenerId = sp.get('listener')?.slice(0, 64) || undefined
    const cursor = (key: string) => {
      const n = Number(sp.get(key))
      return Number.isInteger(n) ? n : -1
    }
    const state = await getStationState(slug, {
      listenerId,
      listenerUser: { id: me.id, name: me.name },
      sinceSfx: cursor('sinceSfx'),
      sinceChunk: cursor('sinceChunk'),
    })
    if (!state) return Response.json({ error: 'Fant ikke kanalen' }, { status: 404 })
    return Response.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return errorResponse(err)
  }
}
