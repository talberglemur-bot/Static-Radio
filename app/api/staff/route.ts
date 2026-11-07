import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { errorResponse, requireAdmin, requireStaff } from '@/lib/session'

export async function GET() {
  try {
    await requireStaff()
    const rows = await db
      .select({ id: user.id, name: user.name, email: user.email, role: user.role })
      .from(user)
      .where(inArray(user.role, ['admin', 'staff']))
      .orderBy(asc(user.createdAt))
    return Response.json(rows)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const { email } = await req.json()
    const normalized = String(email ?? '').trim().toLowerCase()
    const [target] = await db.select().from(user).where(eq(user.email, normalized))
    if (!target) {
      return Response.json(
        { error: 'Ingen konto med den e-posten. Be personen registrere seg først.' },
        { status: 404 },
      )
    }
    if (target.role === 'admin') return Response.json({ ok: true })
    await db.update(user).set({ role: 'staff' }).where(eq(user.id, target.id))
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin()
    const { id } = await req.json()
    if (id === admin.id) {
      return Response.json({ error: 'Du kan ikke fjerne deg selv' }, { status: 400 })
    }
    await db.update(user).set({ role: 'listener' }).where(eq(user.id, String(id)))
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
