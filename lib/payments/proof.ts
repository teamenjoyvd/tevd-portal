/**
 * Proof-of-payment object paths (2607-DEV-676 security follow-up).
 *
 * `payments.proof_url` is not a URL — it is a key into the PRIVATE `trip-proofs`
 * bucket, minted as `${profile_id}/${uuid}.${ext}` by
 * app/api/profile/payments/upload-url/route.ts. It is only ever readable through
 * a signed URL, and the only member-facing route that signs one is
 * app/api/profile/payments/[id]/proof — which authorises by asking who the PAYER
 * of that row is.
 *
 * That check is only sound if a caller cannot put someone else's object path on
 * a row they are the payer of. Nothing enforced that: both member POST routes
 * wrote `proof_url` straight from the request body. The ownership guard already
 * existed at app/api/profile/payments/upload-url/confirm/route.ts:22-30 but sits
 * on a route a hand-crafted request simply skips.
 *
 * Two independent defences, either of which closes the hole:
 *   1. assertOwnProofPath — on WRITE, a path must be under the caller's own
 *      prefix, so a foreign object can never be attached to your row.
 *   2. redactForeignProofUrls — on READ, never hand the path to anyone but the
 *      payer, so the value needed to attempt (1) is not disclosed in the first
 *      place. Group rows made this reachable: a beneficiary owns a row whose
 *      proof was uploaded by, and depicts the bank details of, the payer.
 */

/** Columns needed to decide who paid. Both are optional so this accepts the
 *  narrower row shapes the trip and profile routes select. */
export type ProofRow = {
  proof_url?: string | null
  profile_id?: string | null
  paid_by_profile_id?: string | null
}

/**
 * Who actually transferred the money. Legacy and self-paid rows leave
 * `paid_by_profile_id` NULL and the payer is the row owner; group rows name the
 * payer explicitly. `??` not `||` — an id is never 0 or "" but the zero-is-data
 * rule is repo policy, and `||` would also swallow an empty string.
 *
 * Returns null when neither column was selected, which callers treat as "not the
 * payer" so a forgotten column fails closed.
 */
export function payerOf(row: ProofRow): string | null {
  return row.paid_by_profile_id ?? row.profile_id ?? null
}

export type ProofPathCheck =
  | { ok: true; value: string | null }
  | { ok: false; error: string }

/**
 * Validates a client-supplied `proof_url` before it is written to a payment row.
 *
 * Mirrors the guard at app/api/profile/payments/upload-url/confirm/route.ts:
 * reject traversal, then require the caller's own `${profile_id}/` prefix. A
 * missing/null proof is legitimate (proof is optional) and passes through as
 * null; anything present but not a string is a malformed request.
 *
 * Deliberately NOT a storage existence check: a caller can only reference paths
 * under a prefix only they can upload to, which is the whole property we need.
 */
export function assertOwnProofPath(proofUrl: unknown, ownerProfileId: string): ProofPathCheck {
  if (proofUrl === undefined || proofUrl === null || proofUrl === '') {
    return { ok: true, value: null }
  }
  if (typeof proofUrl !== 'string') {
    return { ok: false, error: 'proof_url must be a string' }
  }
  if (proofUrl.includes('..')) {
    return { ok: false, error: 'Invalid proof_url' }
  }
  if (!proofUrl.startsWith(`${ownerProfileId}/`)) {
    return { ok: false, error: 'Invalid proof_url' }
  }
  return { ok: true, value: proofUrl }
}

/**
 * Nulls `proof_url` on every row the viewer is not the payer of, returning new
 * objects rather than mutating the PostgREST result in place.
 *
 * A bank-transfer screenshot routinely shows the payer's account number and
 * balance, so a beneficiary may see that the payment exists but must not see the
 * image — nor the path to it. Admin routes do not use this: admins are entitled
 * to the proof and have their own route.
 */
export function redactForeignProofUrls<T extends ProofRow>(rows: T[], viewerProfileId: string): T[] {
  return rows.map((row) => {
    if (row.proof_url === undefined) return row
    if (payerOf(row) === viewerProfileId) return row
    return { ...row, proof_url: null }
  })
}
