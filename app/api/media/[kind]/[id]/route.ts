import { get } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { liveChunk, track } from '@/lib/db/schema'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) return new Response('Fant ikke', { status: 404 })

  let file: { pathname: string; access: string } | undefined
  if (kind === 'track') {
    ;[file] = await db
      .select({ pathname: track.pathname, access: track.access })
      .from(track)
      .where(eq(track.id, numericId))
  } else if (kind === 'chunk') {
    ;[file] = await db
      .select({ pathname: liveChunk.pathname, access: liveChunk.access })
      .from(liveChunk)
      .where(eq(liveChunk.id, numericId))
  }
  if (!file) return new Response('Fant ikke', { status: 404 })

  if (file.access === 'public') {
    return Response.redirect(file.pathname, 302)
  }

  const range = req.headers.get('range')
  try {
    const result = await get(file.pathname, {
      access: 'private',
      headers: range ? { range } : undefined,
    })
    if (!result || !result.stream) return new Response('Fant ikke', { status: 404 })

    const headers = new Headers({
      'Content-Type': result.blob.contentType ?? 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    })
    const contentRange = result.headers.get('content-range')
    const contentLength = result.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)
    if (contentRange) headers.set('Content-Range', contentRange)

    return new Response(result.stream, {
      status: contentRange ? 206 : 200,
      headers,
    })
  } catch (err) {
    console.error('[radio] media error', err)
    return new Response('Fant ikke', { status: 404 })
  }
}
