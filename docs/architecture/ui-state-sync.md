# UI State Sync — Cookie-Based Preference Flow
> tevd-portal · Established: 2026-03-28 · See ADR-014

This document maps the authorised flow for synchronising UI preferences (font size, and any future cosmetic preference) between the server, client, and database.

---

## Authorised Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextJS as App Router (SSR)
    participant API as Profile API
    participant DB as Database

    Note over Browser, NextJS: Initial Request (No Cookie — virgin device / first login)
    Browser->>NextJS: GET / (Auth Token, no tevd-font-size cookie)
    NextJS-->>Browser: HTML <html data-font-size="md"> (fallback default)

    Note over Browser, API: Client Hydration & Reconciliation
    Browser->>API: GET /api/profile
    API->>DB: Read ui_prefs
    DB-->>API: { font_size: "lg" }
    API-->>Browser: 200 OK { font_size: "lg" }
    Browser->>Browser: DOM update: data-font-size="lg" (one-time FOUC — accepted)
    Browser->>Browser: document.cookie = "tevd-font-size=lg; path=/"

    Note over User, DB: Mutation Flow
    User->>Browser: Clicks A+ (set to xl)
    Browser->>Browser: DOM update: data-font-size="xl"
    Browser->>Browser: document.cookie = "tevd-font-size=xl; path=/"
    Browser-)API: PATCH /api/profile { ui_prefs: { font_size: "xl" } } (fire & forget)
    API-)DB: UPDATE profiles SET ui_prefs = ui_prefs || '{"font_size":"xl"}'

    Note over Browser, NextJS: All Subsequent Requests (cookie present)
    Browser->>NextJS: GET / (Auth Token, Cookie: tevd-font-size=xl)
    NextJS-->>Browser: HTML <html data-font-size="xl"> (no FOUC)
```

---

## Responsibility Boundaries

| Layer | Owns | Does NOT own |
|---|---|---|
| `app/layout.tsx` | Reads `tevd-font-size` cookie via `cookies()` from `next/headers`. Applies `data-font-size` to `<html>`. | Writing the cookie. Fetching from DB. |
| `useFontSize` hook | Reads `ui_prefs.font_size` from profile API. Reconciles DOM if cookie differs. Writes cookie on mutation. PATCHes `/api/profile`. | Reading the cookie at boot (layout owns that). |
| `/api/profile` PATCH | Merges `font_size` into `ui_prefs` without clobbering other keys. | Anything cookie-related. |

---

## FOUC Contract

| Scenario | Outcome |
|---|---|
| Returning user, same device | ✅ Zero FOUC. Cookie present → server renders correct attribute. |
| Returning user, new device / incognito | ⚠️ One-time FOUC on first load. Cookie absent → server renders `md` → hook reconciles after profile fetch. Cookie set. All subsequent loads are FOUC-free. |
| User changes preference | ✅ Immediate DOM update (optimistic). Cookie and DB updated synchronously with UI. |
| Cookie tampered / invalid value | ✅ `app/layout.tsx` validates against `['sm', 'md', 'lg']` and falls back to `'md'`. |

The one-time new-device FOUC is an **accepted engineering tradeoff**. Eliminating it would require a blocking DB read in the root layout on every request — an anti-pattern for a purely cosmetic preference. See ADR-014 §Consequences.

---

## Cookie Spec

| Property | Value |
|---|---|
| Name | `tevd-font-size` |
| Values | `sm` \| `md` \| `lg` |
| Path | `/` |
| Max-Age | `31536000` (1 year) |
| SameSite | `Lax` |
| Secure | Inherited from HTTPS in production |
| HttpOnly | `false` — must be readable and writable by client JS |

---

## Extending This Pattern

Any future cosmetic UI preference (e.g., reduced motion, compact density) should follow this same pattern:

1. Add the key to `profiles.ui_prefs` JSONB (no migration needed — JSONB is schema-flexible).
2. Add a named cookie (`tevd-<preference>`).
3. Read the cookie in `app/layout.tsx` and apply as a `data-*` attribute on `<html>`.
4. Create a dedicated hook (`use<Preference>.ts`) following the `useFontSize` pattern.
5. Add the cookie spec to this document.

Do **not** use `localStorage` for any preference that needs to be server-rendered. See ADR-014 for the rationale.
