import { getSessionUser } from '@/lib/session'

export async function GET() {
  const u = await getSessionUser()
  return Response.json(u, { headers: { 'Cache-Control': 'no-store' } })
}
