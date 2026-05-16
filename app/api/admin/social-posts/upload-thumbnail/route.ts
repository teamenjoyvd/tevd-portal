/**
 * DEPRECATED — replaced by signed URL flow.
 * Use GET /api/admin/social-posts/upload-url + PUT (direct to storage) +
 * POST /api/admin/social-posts/upload-url/confirm instead.
 *
 * This route is kept as a stub to avoid breaking any in-flight requests
 * during deployment. Remove after next release cycle.
 */
export async function POST() {
  return Response.json(
    { error: 'This endpoint is deprecated. Use /api/admin/social-posts/upload-url instead.' },
    { status: 410 },
  )
}
