// Retired — superseded by POST/DELETE /api/admin/members/[id]/vital-signs (ISS-0161/ISS-0175)
// This route used the old member_vital_signs schema (event_key, event_label, has_ticket)
// which no longer exists. Kept as a stub to avoid 404s during any in-flight requests.

export async function PATCH() {
  return Response.json(
    { error: 'This endpoint is retired. Use POST/DELETE /api/admin/members/[id]/vital-signs instead.' },
    { status: 410 }
  )
}
