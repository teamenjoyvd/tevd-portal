// DEPRECATED — replaced by /api/admin/payments (ISS-0191)
export async function GET(): Promise<Response> {
  return Response.json({ error: 'Gone. Use /api/admin/payments' }, { status: 410 })
}
export async function POST(): Promise<Response> {
  return Response.json({ error: 'Gone. Use /api/admin/payments' }, { status: 410 })
}
