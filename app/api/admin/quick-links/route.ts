export async function GET(): Promise<Response> {
  return Response.json({ error: 'Gone — use /api/admin/links' }, { status: 410 })
}
export async function POST(): Promise<Response> {
  return Response.json({ error: 'Gone — use /api/admin/links' }, { status: 410 })
}
