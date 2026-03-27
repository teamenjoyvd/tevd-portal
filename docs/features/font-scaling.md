# Feature Spec — Font Size Scaling
> tevd-portal · Created: 2026-03-28
> Tickets: SEQ272 (hook), SEQ273 (UserPopup), SEQ274 (UserDropdown)
> Architecture: See ADR-014, docs/architecture/ui-state-sync.md

---

## Overview

Users can set a preferred font size (Small / Medium / Large) from the user popup (desktop) and user dropdown (mobile/admin). The preference persists across sessions and devices via a two-layer sync: cookie (boot transport) + `profiles.ui_prefs` (source of truth).

---

## Allowed Values

| Value | CSS scale | Label |
|---|---|---|
| `sm` | `0.875` (14px base) | A- |
| `md` | `1.000` (16px base) | A (default) |
| `lg` | `1.125` (18px base) | A+ |

---

## Persistence Model

**Source of truth:** `profiles.ui_prefs.font_size` (JSONB key — no migration required).

**Boot transport:** `tevd-font-size` cookie. Set by the client on every mutation. Read by `app/layout.tsx` on every server render. See `docs/architecture/ui-state-sync.md` for the complete flow.

**Merge rule:** PATCH to `/api/profile` must use JSONB merge (`||` operator or equivalent), never a full replace. `bento_order` and `bento_collapsed` must not be clobbered.

---

## Responsibility Split

### `app/layout.tsx` (SEQ272)
- Reads `tevd-font-size` cookie via `cookies()` from `next/headers`.
- Validates value against `['sm', 'md', 'lg']`; falls back to `'md'` if absent or invalid.
- Applies as `data-font-size={value}` on `<html>`.
- **Does not** write the cookie. **Does not** fetch from DB.

### `lib/hooks/useFontSize.ts` (SEQ272)
- Reads `ui_prefs.font_size` from the profile API response.
- On mount: if `ui_prefs.font_size` differs from the current `data-font-size` attribute (set by server from cookie), reconciles DOM and writes cookie. This is the cross-device sync path.
- `setFontSize(value)`: updates DOM attribute → writes cookie → PATCHes `/api/profile` (fire & forget).
- `resetFontSize()`: calls `setFontSize('md')`.
- Dispatches `tevd-font-size-change` DOM event for same-tab consumers.
- **Does not** read the cookie at boot (layout owns that).

### `components/layout/UserPopup.tsx` (SEQ273)
- Calls `useFontSize()`.
- Renders A- / A / A+ buttons. Active value gets a highlighted state.
- Renders a Reset button visible only when `currentSize !== 'md'`.
- Uses `onClick` handlers only — no `<form>` (Popover constraint).
- 390px: row must not overflow; minimum 44px tap target per button.

### `components/layout/UserDropdown.tsx` (SEQ274)
- Same controls as UserPopup.
- `DropdownMenu` must not close on font size button click. Use `onSelect={(e) => e.preventDefault()}` on `DropdownMenu.Item` wrappers.
- Reset button visible only when `currentSize !== 'md'`.

---

## CSS Implementation

In `styles/brand-tokens.css`:

```css
:root            { --font-scale: 1; }
[data-font-size='sm'] { --font-scale: 0.875; }
[data-font-size='md'] { --font-scale: 1; }
[data-font-size='lg'] { --font-scale: 1.125; }
html             { font-size: calc(var(--font-scale) * 16px); }
```

All Tailwind rem-based utilities (text-sm, text-base, text-lg, etc.) scale automatically with `html { font-size }`. No per-component changes required.

---

## FOUC Contract

See `docs/architecture/ui-state-sync.md`. Summary:
- Returning session, same device: zero FOUC.
- First login on new device: one-time FOUC (accepted tradeoff).
- All subsequent loads on that device: zero FOUC.

---

## Out of Scope

- Exposing the setting on the `/profile` settings bento (not in this workstream).
- Applying the preference to unauthenticated public pages (`/`, `/about`, `/calendar`, `/trips`) — these routes are outside the auth wall and have no profile context at SSR time.
- An `xl` (extra-large) size tier — three tiers cover the accessibility range without risk of layout overflow at 390px.
