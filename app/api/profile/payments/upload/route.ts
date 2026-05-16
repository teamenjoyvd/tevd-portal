/**
 * DEPRECATED — replaced by signed URL flow.
 * Use GET /api/profile/payments/upload-url + PUT (direct to storage) +
 * POST /api/profile/payments/upload-url/confirm instead.
 *
 * This route is kept as a stub to avoid breaking any in-flight requests
 * during deployment. Remove after next release cycle.
 */
export async function POST() {
  return Response.json(
    { error: 'This endpoint is deprecated. Use /api/profile/payments/upload-url instead.' },
    { status: 410 },
  )
}
