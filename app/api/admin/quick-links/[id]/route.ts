export async function PATCH(): Promise<Response> {
  return Response.json({ error: 'Gone — use /api/admin/links' }, { status: 410 })
}
export async function DELETE(): Promise<Response> {
  return Response.json({ error: 'Gone — use /api/admin/links' }, { status: 410 })
}
