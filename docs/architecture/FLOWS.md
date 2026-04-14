# FLOWS.md — Component Flows (C4 L3)
> tevd-portal · Last updated: 2026-04-14
> Scope: Ambiguous zones only. Simple CRUD with no branching logic is not documented here.
> Tooling: Mermaid state and sequence diagrams.

---

## Index

1. [Auth & Role Sync](#1-auth--role-sync)
2. [Registration State Machine](#2-registration-state-machine)
3. [Payment Lifecycle](#3-payment-lifecycle)
4. [LOS Tree Propagation](#4-los-tree-propagation)
5. [Vital Signs](#5-vital-signs)

A flow is added here when a ticket produces ambiguity about state transitions, ownership boundaries, or sequencing. If a feature idea touches one of these flows, the flow diagram must be verified (and updated if it changes) before the ticket is executed.

---

## 1. Auth & Role Sync

### Problem this documents
Clerk owns the session. Supabase owns the profile. RLS policies read the Clerk JWT. This means two systems must agree on `role` at all times — and the sync is manual, not automatic.

### Clerk Webhook → Profile Creation

When a new user signs up via Clerk, a `user.created` webhook fires to `/api/webhooks/clerk`. This is the only place a `profiles` row is created for a new user.

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant C as Clerk
    participant W as /api/webhooks/clerk
    participant S as Supabase

    U->>C: Sign up
    C->>C: Create user (role = undefined in metadata)
    C->>W: POST user.created webhook
    W->>W: Verify svix signature (CLERK_WEBHOOK_SECRET)
    W->>S: INSERT profiles (clerk_id, role='guest')
    W-->>C: 200 OK
    Note over S: New profile has role='guest'.<br/>Clerk publicMetadata has no role yet.<br/>RLS treats missing role as guest.
```

### Role Promotion

Role promotion happens through three admin routes. Every promotion is a two-write atomic operation: Supabase first, then Clerk. If the Clerk write fails, the Supabase write is not rolled back — this is a known gap. Re-login by the user will re-read Clerk metadata, but Supabase will already have the new role.

```mermaid
sequenceDiagram
    participant A as Admin (Browser)
    participant R as API Route
    participant S as Supabase profiles
    participant C as Clerk

    A->>R: Approve verification / promote role
    R->>S: UPDATE profiles SET role = 'member' WHERE clerk_id = X
    R->>C: updateUserMetadata(clerkId, { publicMetadata: { role: 'member' } })
    C-->>R: OK
    R-->>A: 200

    Note over S,C: Both must be written.<br/>Routes: /api/admin/verify,<br/>/api/admin/members/verify/[id],<br/>/api/admin/members/[id] PATCH
```

### RLS Auth Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Next.js API Route
    participant S as Supabase (RLS)

    B->>N: Request (with Clerk session cookie)
    N->>N: await auth() → { userId }
    N->>N: createServiceClient() — service role bypasses RLS
    N->>S: Query with service role
    S-->>N: Data (no RLS applied — service role)
    N->>N: Apply business-layer access check (role from profile)
    N-->>B: Response

    Note over N,S: All server DB access uses service role — RLS is never evaluated on server routes.<br/>Access control is TypeScript in the route handler.<br/>RLS policies exist as defence-in-depth only, protecting against hypothetical direct DB access.<br/>They are not the primary enforcement mechanism.<br/>Never disable RLS to fix a bug — fix the policy or the route logic.
```

**Invariant:** The application never uses the anon key or a JWT Supabase client on the server. All server DB access is service role. RLS policies exist as a defence-in-depth layer, not the primary access control mechanism on the server.

---

## 2. Registration State Machine

### States

```mermaid
stateDiagram-v2
    [*] --> pending : Member submits registration
    pending --> approved : Admin approves
    pending --> denied : Admin denies
    pending --> cancelled : Member cancels (cancelled_at set)
    approved --> cancelled : Admin cancels (cancelled_at set)

    note right of cancelled
        No 'cancelled' status value exists.
        Cancelled signal = cancelled_at IS NOT NULL.
        Status field remains at its last value.
    end note

    note right of denied
        Denied member can re-register.
        RegisterButton shown when no registration
        OR status = 'denied'.
    end note
```

### Rules
- A member with `status = 'pending'` or `status = 'approved'` cannot register again for the same trip.
- A member with `status = 'denied'` OR no registration can register (RegisterButton is shown).
- Only `status = 'approved'` members see the "View Trip Details" button → `/trips/[id]`.
- Cancel routes: member → `POST /api/profile/trips/[id]/cancel`; admin → `POST /api/admin/trips/registrations/[id]/cancel`. Both set `cancelled_at`. 409 if already cancelled.
- `trip_registrations` has no `cancelled` enum value. Do not add one without a migration that also handles the cancelled_at signal.

---

## 3. Payment Lifecycle

### Context
tevd-portal has no payment processor. All payments are manual records — either submitted by members with proof, or logged directly by admins. Approval is a dual-gate: `admin_status` AND `member_status` must both be `approved` for a payment to be considered green.

Payments are always linked to exactly one entity: a trip (`trip_id`) OR a payable item (`payable_item_id`). The DB enforces this via a check constraint (`num_nonnulls(trip_id, payable_item_id) = 1`).

### Dual-Approval State Machine

```mermaid
stateDiagram-v2
    [*] --> member_pending_admin_pending

    member_pending_admin_pending --> member_approved_admin_pending : Member submits\n(member_status=approved,\nlogged_by_admin=NULL)
    member_pending_admin_pending --> member_pending_admin_approved : Admin logs payment\n(admin_status=approved,\nlogged_by_admin=admin_id)

    member_approved_admin_pending --> GREEN : Admin approves\nmember submission
    member_approved_admin_pending --> member_approved_admin_rejected : Admin rejects

    member_pending_admin_approved --> GREEN : Member confirms\nadmin-logged payment
    member_pending_admin_approved --> member_rejected_admin_approved : Member disputes

    GREEN : ✅ Both approved\n(admin_status=approved\nmember_status=approved)
```

### Member Submission Flow

```mermaid
sequenceDiagram
    participant M as Member (Browser)
    participant R as /api/payments (POST)
    participant S as Supabase payments

    M->>R: POST { trip_id | payable_item_id, amount, date, method, note, proof_url }
    R->>R: await auth() → userId → profileId
    R->>S: INSERT payments\n(member_status='approved',\nadmin_status='pending',\nlogged_by_admin=NULL)
    S-->>R: Created row
    R-->>M: 201

    Note over S: Admin must now approve to reach GREEN state.
```

### Admin Logging Flow

```mermaid
sequenceDiagram
    participant A as Admin (Browser)
    participant R as /api/admin/payments (POST)
    participant S as Supabase payments

    A->>R: POST { profile_id, trip_id | payable_item_id, amount, date, method, note }
    R->>R: await auth() → verify admin role
    R->>S: INSERT payments\n(admin_status='approved',\nmember_status='pending',\nlogged_by_admin=admin_profile_id)
    S-->>R: Created row
    R-->>A: 201

    Note over S: Member must confirm to reach GREEN state.<br/>Member sees this as a pending admin-logged entry.
```

### Admin Status Update

```mermaid
sequenceDiagram
    participant A as Admin
    participant R as /api/admin/payments/[id] (PATCH)
    participant S as Supabase payments

    A->>R: PATCH { admin_status: 'approved' | 'rejected', admin_note? }
    R->>S: UPDATE payments SET admin_status=..., admin_note=...
    S-->>R: Updated row
    R-->>A: 200
```

### Invariants
- `logged_by_admin IS NULL` → member-submitted. Member can update own admin-logged rows only.
- `logged_by_admin IS NOT NULL` → admin-logged. `admin_status` starts as `approved`.
- GREEN = `admin_status = 'approved' AND member_status = 'approved'`.
- Entity constraint is DB-enforced. API routes must pass exactly one of `trip_id` / `payable_item_id`.
- FK ambiguity: any PostgREST join from `payments` to `profiles` must use `profiles!profile_id(...)`.

---

## 4. LOS Tree Propagation

### Context
The organisation hierarchy is stored as a materialized path tree in `tree_nodes` using the PostgreSQL `ltree` extension. Each node has a `path` column (e.g., `100001.100045.p_abc123`) that encodes the full ancestor chain. This makes subtree queries O(log n) with a GiST index instead of recursive CTEs.

### Node Types
- **ABO node:** `path` label is the ABO number (e.g., `100001`)
- **No-ABO node:** `path` label is `p_<uuid_no_hyphens>` (e.g., `p_abc123def456`)
- On ABO assignment, the no-ABO label is renamed to the real ABO number and `rebuild_tree_paths` is called to cascade the rename down all descendants.

### Member Verification → Tree Placement

```mermaid
sequenceDiagram
    participant A as Admin
    participant R as /api/admin/verify (or /members/verify/[id])
    participant S as Supabase

    A->>R: Approve verification (claimed_abo, upline_abo)
    R->>S: UPDATE profiles SET role='member', abo_number=claimed_abo
    R->>S: Find tree_nodes row for upline_abo
    R->>S: INSERT tree_nodes\n(profile_id, parent_id=upline_node.id,\npath=upline_node.path.claimed_abo,\ndepth=upline_node.depth+1)
    R->>Clerk: updateUserMetadata → role='member'
    R-->>A: 200

    Note over S: Path is computed as upline path + '.' + new label.<br/>No recursive rebuild needed for a leaf insert.
```

### No-ABO Placement (Manual Verification)

```mermaid
sequenceDiagram
    participant A as Admin
    participant R as /api/admin/verify
    participant S as Supabase

    A->>R: Approve manual verification (upline_abo only, no claimed_abo)
    R->>S: UPDATE profiles SET role='member'\n(abo_number stays NULL)
    R->>S: Find tree_nodes row for upline_abo
    R->>S: INSERT tree_nodes\n(profile_id, parent_id=upline_node.id,\npath=upline_node.path.p_<uuid>,\ndepth=upline_node.depth+1)
    R->>Clerk: updateUserMetadata → role='member'
    R-->>A: 200

    Note over S: Label is p_<uuid_no_hyphens>.<br/>If ABO is later assigned, rebuild_tree_paths<br/>renames the label and cascades to all descendants.
```

### Subtree Query Pattern

```mermaid
sequenceDiagram
    participant C as Core member (Browser)
    participant R as /api/profile/los-summary (or /admin/members)
    participant S as Supabase tree_nodes

    C->>R: GET downline
    R->>S: SELECT path FROM tree_nodes WHERE profile_id = caller_profile_id
    S-->>R: caller_path (e.g., '100001.100045')
    R->>S: SELECT * FROM tree_nodes\nWHERE path <@ caller_path\nAND path != caller_path
    S-->>R: All descendant nodes (ltree operator <@)
    R->>S: JOIN profiles on profile_id for each node
    R-->>C: { scope, nodes, caller_abo }

    Note over R,C: Response shape always { scope, nodes, caller_abo }.<br/>Caller must extract .nodes before calling buildTree().
```

### Notification Fan-Out

Tree structure drives targeted notification delivery:
- `get_core_ancestors(uuid)` — returns Core-role profile UUIDs above the given node via ltree ancestor query
- `notify_role_request` — notifies admins + Core ancestors of the requester
- `notify_calendar_event_created` (Core-created) — fans down to all descendants + fans up to Core ancestors
- `run_los_digest` — pg_cron, 06:00 UTC daily, aggregates LOS activity into a single digest notification per member

### Invariants
- Every `tree_nodes` row has a `path` that is a valid ltree label chain matching the ancestor chain up to root.
- `rebuild_tree_paths` must be called after any ABO number assignment that renames a node label.
- LOS import always wins for tree positioning — manual placement is overridden on next import reconciliation.
- No-ABO labels (`p_<uuid>`) are internal identifiers. They are never displayed to users.

---

## 5. Vital Signs

> ✅ Status: **Stable / Implemented** — state model established via 2604-BUG-001 (PR #32) and API corrected via 2604-BUG-002 (PR #33), both 2026-04-14.

### Context

Vital signs track per-member health or qualification markers. Each sign belongs to a `vital_sign_definitions` category (admin-managed). Recording is admin-only — members have read access only. There is no dual-approval and no member confirmation step.

### Data Model

- `vital_sign_definitions` — admin-managed category/label definitions; `is_active` controls whether the definition appears in the member-facing matrix
- `member_vital_signs` — one row per `(profile_id, definition_id)`, UNIQUE constraint enforced at DB level
  - `is_active boolean NOT NULL DEFAULT true` — active/inactive toggle; row is never deleted
  - `recorded_at`, `recorded_by` — updated on every activate (upsert)

### State Machine

```mermaid
stateDiagram-v2
    [*] --> active : Admin activates (POST upsert)
    active --> inactive : Admin deactivates (PATCH is_active=false)
    inactive --> active : Admin re-activates (POST upsert — updates recorded_at/recorded_by)

    note right of active
        Row exists with is_active=true.
        recorded_at and recorded_by reflect
        the most recent activation.
    end note

    note right of inactive
        Row exists with is_active=false.
        History is preserved.
        No data loss on deactivate.
    end note
```

### Activate / Re-activate Flow

```mermaid
sequenceDiagram
    participant A as Admin (Browser)
    participant R as POST /api/admin/members/[id]/vital-signs
    participant S as Supabase member_vital_signs

    A->>R: POST { definition_id }
    R->>R: await auth() → verify admin role → resolve profile_id
    R->>S: UPSERT (profile_id, definition_id)\n  SET is_active=true, recorded_at=now(), recorded_by=admin_profile_id\n  ON CONFLICT (profile_id, definition_id) DO UPDATE
    S-->>R: Upserted row
    R-->>A: 200

    Note over S: Idempotent. Re-activating an existing record<br/>updates recorded_at and recorded_by without<br/>violating the UNIQUE constraint.
```

### Deactivate Flow

```mermaid
sequenceDiagram
    participant A as Admin (Browser)
    participant R as PATCH /api/admin/members/[id]/vital-signs/[definitionId]
    participant S as Supabase member_vital_signs

    A->>R: PATCH (no body required)
    R->>R: await auth() → verify admin role → resolve profile_id
    R->>S: UPDATE member_vital_signs\n  SET is_active=false\n  WHERE profile_id=X AND definition_id=Y
    S-->>R: Updated row
    R-->>A: 200

    Note over S: Row is retained. History preserved.<br/>No DELETE ever issued against member_vital_signs.
```

### Member Profile API (`/api/profile/vital-signs`)

Returns one entry per **active** `vital_sign_definitions` row (`.eq('is_active', true)`), left-joined against `member_vital_signs` for the requesting profile. Each entry carries `is_recorded` and `is_active` so the UI can distinguish unrecorded, recorded-active, and recorded-inactive states without additional queries.

### LOS Tree Surface (`/api/los/tree`)

The tree endpoint fetches **all** vital sign records for each member regardless of `is_active`, and surfaces `is_active` per record. Rendering decisions (active = underlined crimson, inactive = dimmed) are made at the component level (`NodeCard`), not at the query level.

### Invariants
- **Never DELETE from `member_vital_signs`.** Deactivate only (`is_active=false`).
- **Activate = upsert**, not INSERT. This is the only safe path given the UNIQUE constraint.
- Admin-only write access. Members read via `/api/profile/vital-signs` (returns `is_active` per record).
- `/api/profile/vital-signs` filters definitions by `is_active=true` — retired definitions do not appear in the member matrix.
- Definition toggle (enable/disable a definition globally) is a separate concern managed via `vital_sign_definitions` — it does not affect existing `member_vital_signs` rows.
