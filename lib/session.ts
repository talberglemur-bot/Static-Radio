import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'

export type Role = 'admin' | 'staff' | 'listener'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  // Read the role fresh from the DB so promotions/demotions apply immediately.
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
  if (!row) return null
  // Studio access is tied to a single owner account; everyone else is a listener.
  const role: Role = row.email.toLowerCase() === STATION_OWNER_EMAIL ? 'admin' : 'listener'
  return { ...row, role }
}

export const STATION_OWNER_EMAIL = 'talberglemur@gmail.com'

export function isStaff(u: SessionUser | null) {
  return u?.role === 'admin'
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function requireUser() {
  const u = await getSessionUser()
  if (!u) throw new HttpError(401, 'Du må logge på')
  return u
}

export async function requireStaff() {
  const u = await requireUser()
  if (!isStaff(u)) throw new HttpError(403, 'Kun for medarbeidere')
  return u
}

export async function requireAdmin() {
  const u = await requireUser()
  if (u.role !== 'admin') throw new HttpError(403, 'Kun for administratorer')
  return u
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status })
  }
  console.error('[radio] unexpected error', err)
  return Response.json({ error: 'Noe gikk galt' }, { status: 500 })
}
