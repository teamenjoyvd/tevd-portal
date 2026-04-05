// DEPRECATED — superseded by /api/profile/vital-signs (ISS-0161)
// Zero call sites confirmed before removal. Returns 410 Gone.
// TODO: git rm this file once confirmed in production logs.
export async function GET(): Promise<Response> {
  return Response.json(
    { error: 'This endpoint has been removed. Use /api/profile/vital-signs instead.' },
    { status: 410 }
  )
}
