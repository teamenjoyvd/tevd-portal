# Profile Page Refactor — Spec Doc
> SEQ331-ISS331 · Status: Awaiting approval before EXECUTE
> Author: Claude · Date: 2026-04-06

---

## Problem

`app/(dashboard)/profile/page.tsx` is 64KB and ~1,600 lines. It contains:
- 10 `useQuery` calls
- 7 `useMutation` calls
- 7 drawer open/close `useState` pairs
- 7 sections of inline drawer JSX
- 7 memo'd tile content components
- All shared types
- The `SortableBento` wrapper component
- Validation functions, status style maps, constants

The result is a file that is expensive to reason about, impossible to navigate without an IDE, and where any change to one section risks touching unrelated sections.

---

## Goal

`page.tsx` becomes a grid orchestrator: bento order state, collapse state, DnD context, reset button. Nothing else. Target ≤150 lines.

Each section becomes a self-contained component that owns its query, its mutation(s), its drawer, and its drawer open state. Page.tsx has no knowledge of section internals.

---

## Files Created

### `app/(dashboard)/profile/types.ts` (new)

Exports all shared types. No duplication across section files.

```ts
export type UiPrefs = { ... }
export type Profile = { ... }
export type VerificationRequest = { ... }
export type UplineData = { ... }
export type TripEntry = { ... }
export type TripPayment = { ... }
export type PayableItem = { ... }
export type GenericPayment = { ... }
export type VitalSign = { ... }
export type EventRoleRequest = { ... }
export type LosSummaryData = { ... }
```

Also exports shared constants and utilities used by multiple sections:
- `EXPIRY_TOKEN` — travel-doc expiry state → semantic status token, consumed by `StatusBadge`
- `VARIABLE_CAP`
- `ShowMoreButton`
- `TripRow`
- `PaymentRow`

Status badges (`PAYMENT_STATUS_STYLES`/`REG_STATUS_STYLES` — removed) are now rendered by
`app/(dashboard)/profile/components/StatusBadge.tsx`, which resolves a raw status string to
one of the semantic `--status-*` tokens in `styles/brand-tokens.css` (mirrors
`components/admin/StatusPill.tsx`, but the caller supplies the label).

### `app/(dashboard)/profile/components/SortableBento.tsx` (new)

Extracted from the inline definition in page.tsx. No changes to logic — pure extraction.

Props contract:
```ts
{
  id: string
  collapsed: boolean
  onToggleCollapse: () => void
  colSpan: number
  minHeight: number
  children: ReactNode
}
```

### `app/(dashboard)/profile/components/TripsSection.tsx` (new)

**Owns:**
- `useQuery(['profile-trips'])` → `fetch('/api/profile/payments')`
- `useMutation` → cancel trip (`/api/profile/trips/[id]/cancel`)
- `useState(false)` for the full-list drawer
- The `TripsContent` tile JSX
- The "All Trips" `<Drawer>` JSX

**Does not accept data props from page.tsx.** Receives `profileId` and `role` to gate the `enabled` flag.

**Returns:** `{ node: ReactNode; colSpan: number; minHeight: number }` — page.tsx puts this into `bentoMap`.

### `app/(dashboard)/profile/components/PaymentsSection.tsx` (new)

**Owns:**
- `useQuery(['profile-generic-payments'])` → `fetch('/api/payments')`
- `useQuery(['payable-items'])` → `fetch('/api/payable-items')`
- `useMutation` → submit payment (`/api/payments` POST + optional upload)
- `useState` for: submit drawer open, full-list drawer open, all payment form fields
- The `PaymentsContent` tile JSX
- The "Submit Payment" `<Drawer>` JSX
- The "All Payments" `<Drawer>` JSX

**Receives:** `cancelledTripIds: Set<string>` — derived from trips data which this section does not own. This is the one cross-section dependency. It is a primitive (a Set), not a query result, so passing it does not couple data fetching.

### `app/(dashboard)/profile/components/VitalsSection.tsx` (new)

**Owns:**
- `useQuery(['profile-vitals'])` → `fetch('/api/profile/vital-signs')`
- `useState(false)` for the full-list drawer
- The `VitalsContent` tile JSX
- The "All Vital Signs" `<Drawer>` JSX

### `app/(dashboard)/profile/components/ParticipationSection.tsx` (new)

**Owns:**
- `useQuery(['profile-event-roles'])` → `fetch('/api/profile/event-roles')`
- `useState(false)` for the full-list drawer
- The `ParticipationContent` tile JSX
- The "All Participation" `<Drawer>` JSX

### `app/(dashboard)/profile/components/CalendarSection.tsx` (new)

**Owns:**
- `useQuery(['cal-feed-token'])` → `fetch('/api/calendar/feed-token')`
- `useMutation` → regenerate token (`/api/calendar/feed-token` POST)
- `useState(false)` for cal copy flash
- The `CalendarContent` tile JSX

No drawer. No drawer state.

### `app/(dashboard)/profile/components/StatsSection.tsx` (new)

**Owns:**
- `useQuery(['profile-los-summary'])` → `fetch('/api/profile/los-summary')`
- The `StatsContent` tile JSX

Receives `role: string` and `aboNumber: string | null` to gate `enabled`.

### `app/(dashboard)/profile/components/AdminSection.tsx` (new)

Pure presentational. No query. No state.

The `AdminContent` component extracted as a file. No props required.

---

## Files Modified

### `app/(dashboard)/profile/page.tsx`

After the refactor, `page.tsx` contains only:

1. **Imports** — section components, `SortableBento`, DnD kit, constants from `types.ts`
2. **`bentoOrder` + `bentoCollapsed` state** — the two layout state variables
3. **`persistDebounceRef`** — the debounced PATCH to `/api/profile` for layout persistence
4. **`useQuery(['profile'])`** — the single profile fetch that gates the page
5. **DnD sensors, `handleDragEnd`, `toggleCollapse`, `resetLayout`** — the layout orchestration
6. **`ProfileSkeleton`** — the loading fallback
7. **The grid JSX** — `DndContext` → `SortableContext` → grid div → `SortableBento` wrapping each section component
8. **`bentoMap`** — mapping section IDs to `{ colSpan, minHeight, node }` — node is the section component

The `bentoMap` entries that currently inline large JSX blocks are replaced by:
```tsx
[BENTO_IDS.TRIPS]: !isGuest ? {
  colSpan: 6,
  minHeight: BENTO_HEIGHT.M,
  node: <TripsSection profileId={p.id} role={p.role} />,
} : null,
```

No drawer states. No mutation state. No form state. No query results other than `profile`.

---

## The `cancelledTripIds` Cross-Section Dependency

`PaymentsSection` needs to know which trips are cancelled so it can display the ⓘ annotation on affected payment rows. This data comes from `TripsSection`'s query.

Two options:

**Option A — Hoist to page.tsx:**
`TripsSection` accepts an `onCancelledTripIdsChange` callback. Page.tsx holds a `cancelledTripIds: Set<string>` state and passes it to `PaymentsSection`. This keeps sections autonomous but reintroduces state in page.tsx.

**Option B — Duplicate the query:**
`PaymentsSection` runs `useQuery(['profile-trips'])` itself (same query key as `TripsSection`). TanStack Query deduplicates the network request — only one fetch is made. `PaymentsSection` derives `cancelledTripIds` from its own copy of the data.

**Decision: Option B.** The query is already cached. Network cost is zero. Page.tsx stays clean. This aligns with the ADR-015 principle that sections are autonomous — they do not depend on other sections for their data.

---

## `minHeight` Strategy

The DoD specifies Option B: **static `defaultMinHeight` per section ID**. The current `bentoMinHeight(itemCount)` function (which derives height from data length) is removed. Each section reports a fixed `minHeight` constant.

| Section ID | `minHeight` |
|---|---|
| `personal-details` | `BENTO_HEIGHT.M` (280) |
| `abo-info` | `BENTO_HEIGHT.M` (280) |
| `travel-doc` | `BENTO_HEIGHT.S` (160) |
| `settings` | `BENTO_HEIGHT.M` (280) |
| `trips` | `BENTO_HEIGHT.M` (280) |
| `payments` | `BENTO_HEIGHT.M` (280) |
| `vitals` | `BENTO_HEIGHT.M` (280) |
| `participation` | `BENTO_HEIGHT.M` (280) |
| `calendar` | `BENTO_HEIGHT.S` (160) |
| `stats` | `BENTO_HEIGHT.S` (160) |
| `admin` | `BENTO_HEIGHT.S` (160) |

`bentoMinHeight()` is deleted.

---

## What Is Not Changed

- `PersonalDetailsContent`, `AboInfoContent`, `TravelDocContent`, `UserSettingsContent` — already extracted, untouched
- `PersonalDrawerForm`, `TravelDocDrawerForm` — already extracted, untouched
- Personal and travel doc drawer open states — these remain in page.tsx because the edit triggers (`onEdit` callbacks) are passed into `PersonalDetailsContent` and `TravelDocContent` from page.tsx. Migrating them is out of scope for this ticket.
- All API routes — no changes
- All query keys — no changes
- All staleTime values — no changes
- DnD behaviour — no changes

---

## Definition of Done Verification Plan

1. `types.ts` exists and exports all listed types — no type duplication across section files ✓
2. Each `*Section.tsx` owns its own `useQuery` — grep for `queryFn` in page.tsx returns only `['profile']` ✓
3. `SortableBento.tsx` extracted — grep for `useSortable` in page.tsx returns zero results ✓
4. `DndContext` and `SortableContext` remain in page.tsx — outside all Suspense ✓
5. Each section has a local skeleton fallback as its loading state ✓
6. page.tsx ≤150 lines ✓
7. The 7 inline drawer blocks in the current return are gone from page.tsx ✓
8. `npx tsc --noEmit` passes — zero errors ✓
9. Vercel deployment READY, CI green ✓
10. Profile page renders on desktop and 390px mobile, DnD reorder works ✓
