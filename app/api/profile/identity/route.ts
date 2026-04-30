// DECOMMISSIONED — identity is now resolved server-side in the RSC page.
// See app/(dashboard)/profile/page.tsx.
// This file is intentionally left as a tombstone. Remove in a future cleanup.
export async function GET() {
  return Response.json({ error: 'Gone — use RSC identity resolution' }, { status: 410 })
}
