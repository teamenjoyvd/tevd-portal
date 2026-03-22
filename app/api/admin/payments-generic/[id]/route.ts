// DEPRECATED — replaced by /api/admin/payments/[id] (ISS-0191)
export async function PATCH(): Promise<Response> {
  return Response.json({ error: 'Gone. Use /api/admin/payments/[id]' }, { status: 410 })
}
