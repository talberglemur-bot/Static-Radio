import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { track } from '@/lib/db/schema'
import { errorResponse, requireStaff } from '@/lib/session'
import { publicTrack } from '@/lib/station'
import { storeFile } from '@/lib/storage'

const MAX_BYTES = 4 * 1024 * 1024

export async function GET() {
  try {
    await requireStaff()
    const rows = await db.select().from(track).orderBy(desc(track.id))
    return Response.json(rows.map(publicTrack))
  } catch (err) {
    return errorResponse(err)
  }
}

/**
 * Two ways in: a small file uploaded through this route (multipart), or a
 * large file the browser already uploaded straight to Blob (JSON metadata).
 */
export async function POST(req: Request) {
  try {
    const staff = await requireStaff()
    const contentType = req.headers.get('content-type') ?? ''

    let title: string
    let artist: string
    let kind: string
    let durationSec: number
    let stored: { pathname: string; access: 'private' | 'public' }

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File) || !file.type.startsWith('audio/')) {
        return Response.json({ error: 'Velg en lydfil' }, { status: 400 })
      }
      if (file.size > MAX_BYTES) {
        return Response.json({ error: 'Filen er for stor' }, { status: 413 })
      }
      title = String(form.get('title') ?? '')
      artist = String(form.get('artist') ?? '')
      kind = String(form.get('kind') ?? 'music')
      durationSec = Number(form.get('durationSec'))
      stored = await storeFile(`tracks/${file.name}`, file, file.type)
    } else {
      const body = await req.json()
      title = String(body.title ?? '')
      artist = String(body.artist ?? '')
      kind = String(body.kind ?? 'music')
      durationSec = Number(body.durationSec)
      const access = body.access === 'public' ? 'public' : 'private'
      const pathname = String(body.pathname ?? '')
      if (!pathname.startsWith(access === 'public' ? 'https://' : 'tracks/')) {
        return Response.json({ error: 'Ugyldig opplasting' }, { status: 400 })
      }
      stored = { pathname, access }
    }

    title = title.trim().slice(0, 120) || 'Untitled'
    artist = artist.trim().slice(0, 120) || 'Ukjent artist'
    if (kind !== 'music' && kind !== 'sfx' && kind !== 'ad') kind = 'music'
    durationSec = Number(durationSec)
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return Response.json({ error: 'Kunne ikke lese lengden på sporet' }, { status: 400 })
    }

    const [created] = await db
      .insert(track)
      .values({ title, artist, kind, durationSec, userId: staff.id, ...stored })
      .returning()
    return Response.json(publicTrack(created))
  } catch (err) {
    return errorResponse(err)
  }
}
