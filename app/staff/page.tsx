import { asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { channel } from '@/lib/db/schema'
import { getSessionUser, isStaff } from '@/lib/session'
import { StaffConsole } from '@/components/staff/staff-console'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const me = await getSessionUser()
  if (!me) redirect('/sign-in')
  if (!isStaff(me)) redirect('/')

  const channels = await db
    .select({ slug: channel.slug, name: channel.name, frequency: channel.frequency })
    .from(channel)
    .orderBy(asc(channel.frequency))

  return <StaffConsole channels={channels} isAdmin={me.role === 'admin'} />
}
