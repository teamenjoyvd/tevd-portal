import { getRoleForAccess, listLinksForRole } from '@/lib/server/guides'

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? 100)

  try {
    const role = await getRoleForAccess()
    const data = await listLinksForRole({ role, limit })
    return Response.json(data)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
