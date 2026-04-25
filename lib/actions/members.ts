// ── Admin member mutation helpers ─────────────────────────────────────────────
// Client-side fetch wrappers consumed by react-query mutations in MembersTab.

export type VerifyAction = 'approve' | 'deny'

export type VerifyPayload = {
  id: string
  action: VerifyAction
  admin_note?: string
}

export type PromotePayload = {
  profileId: string
  role: string
}

/** Approve or deny a pending verification request. */
export async function verifyMember({ id, action, admin_note }: VerifyPayload) {
  const res = await fetch(`/api/admin/members/verify/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, admin_note }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error((error as { error?: string }).error ?? res.statusText)
  }
  return res.json()
}

/** Promote or demote a member (e.g. member → core). */
export async function promoteMember({ profileId, role }: PromotePayload) {
  const res = await fetch(`/api/admin/members/${profileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error((error as { error?: string }).error ?? res.statusText)
  }
  return res.json()
}
