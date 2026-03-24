# CONTEXT.md — teamenjoyVD Portal
> Last updated: 2026-03-24 — v2.0.3. Latest stable commit: 2f7f0fd.
> **Read at GATHER start. Never read at SSU.**
> For reference tables (schema, design system, i18n, env vars, API map): `docs/ai/LOOKUP.md`
> For architecture, flows, and decisions: `docs/architecture/`

---

## Section Map — read only what the ticket needs

| Section | Read when ticket touches |
|---|---|
| §1 Key Files & Patterns | `lib/`, `components/`, established patterns |
| §2 Navigation | Header, Footer, AdminNav, `lib/nav.ts` |
| §3 Admin Pages | Any `/admin/*` page |
| §4 CI | `types/supabase.ts`, `check-types.yml` |
| §5 Releases | Release history, pending issues |

**LOOKUP.md section map:**

| Section | Read when ticket touches |
|---|---|
| §1 Directory Tree | New files, new routes, component moves |
| §2 Schema | DB, API routes, migrations, `types/supabase.ts` |
| §3 API / RPC Map | Any API route, TanStack Query fetch |
| §4 Design System | Bento, tokens, colors, layout, role colors |
| §5 i18n & Regional | `translations.ts`, `t()`, `lib/format.ts` |
| §6 Env Vars | New secrets, deployment config |

---

## 1. Key Files & Patterns

### `lib/nav.ts`
Single source of truth for all navigation. Never hardcode nav labels in components.
```ts
PUBLIC_NAV          // Home, About, Calendar, Trips
MEMBER_NAV          // Guides, My Network (/los), Profile (/profile)
FOOTER_MEMBER_NAV   // MEMBER_NAV filtered — excludes /los
ADMIN_NAV           // Approval Hub, Operations, Calendar, Content, Notifications, Members
```
Nav labels use inline `labels: { en, bg }` — NOT the `t()` i18n system.

### `lib/format.ts`
EET/EEST regional formatting. Always import from here — never inline `toLocaleDateString` or Intl.
```ts
formatDate(iso)       // 18.03.2026
formatShortDate(iso)  // 18.03.
formatLongDate(iso)   // Сряда, 18.03.2026
formatTime(iso)       // 14:30
formatDateTime(iso)   // 18.03.2026, 14:30
formatCurrency(n)     // 1.234,00 €
calDay(iso)           // 18
calMonth(iso)         // MAR
```

### `lib/hooks/useTheme.ts`
Single-source-of-truth theme hook. Returns `{ theme, mounted, toggle }`. Same-tab sync via `tevd-theme-change` CustomEvent. Cross-tab via `StorageEvent`. Key: `tevd-theme`.

### `lib/role-colors.ts`
Always `getRoleColors(role)` — never hardcode role bg/font inline.

### `lib/supabase/service.ts`
Singleton service role client. Do not create a new client per request.

### `lib/i18n/translations.ts`
`TranslationKey = keyof typeof translations` — strict union. Every new `t()` call requires a corresponding entry or the build breaks.

### `lib/og-scrape.ts`
Server-only. Returns nulls for IG/FB URLs. Preview endpoint: `/api/admin/social-posts/preview?url=...`.

### `components/ui/Drawer.tsx`
Right slide-over. Use for ALL admin create/edit forms and member-facing modal flows.
Props: `open`, `onClose`, `title`, `children`. Backdrop click + Escape close. Body scroll locked.
Exceptions: Announcements create + Quick Links create stay as inline cards. Delete stays inline with `window.confirm`.

### `components/about/AboutMapTile.tsx`
Client Mapbox tile. Theme-aware (`outdoors-v12` light / `dark-v11` dark). MutationObserver on `data-theme`.

### `components/events/EventPopup.tsx`
- **Mobile (<768px):** Fixed bottom sheet — `85dvh` max, drag handle, `overflow-y-auto`. Backdrop tap-to-close.
- **Desktop:** Anchor-relative popover, clamped to viewport, `maxHeight: 360` on body scroll container.
- **Guest / unauthenticated:** Roles section hidden entirely.

### About Page (`app/(dashboard)/about/page.tsx`) — CANONICAL DUAL LAYOUT REFERENCE
`hidden md:block` desktop grid + `md:hidden` mobile stack. Read before implementing any new dual-layout page.

---

## 2. Navigation

### Header
- Public: `/`, `/about`, `/calendar`, `/trips`
- Auth-only: `/profile`, `/notifications`, `/los`, `/guides`, `/admin`
- Desktop nav: `hidden lg:flex` (1024px+). Mobile hamburger: `lg:hidden`.
- Nav color: `var(--text-nav)` → `var(--brand-parchment)` in dark mode.

### Footer
- Nav order: Home → About → Calendar → Trips → Guides → Profile
- 3-col: brand | nav | socials
- Bottom bar: `© 2026 teamenjoyVD · All rights reserved` | `Built with ♥ by Vera & Deniz in Sofia.`
- **NO BottomNav. Mobile nav = Header hamburger only.**

---

## 3. Admin Pages

| Page | Notes |
|---|---|
| `/admin/approval-hub` | ABO + manual verification + Path C direct-verify |
| `/admin/calendar` | Events ascending by `start_time`. Create/edit via Drawer. |
| `/admin/content` | Tabs: Announcements \| Quick Links \| Guides \| Social Posts \| Bento. Edit via Drawer. |
| `/admin/data-center` | LOS import + reconciliation panel |
| `/admin/notifications` | All-time audit log incl. soft-deleted, paginated 50/page |
| `/admin/operations` | 3 URL-param tabs: `?tab=trips\|items\|payments`. All create/edit via Drawer. |
| `/admin/payable-items` | `redirect()` → `/admin/operations?tab=items` |

**Operations payments tab:** Log Payment Drawer with `<optgroup>` entity select; member selector from `/api/admin/members`; status filter pills; pending member submissions at top.

---

## 4. CI

On every push to `main`: `npx tsc --noEmit`. Workflow: `.github/workflows/check-types.yml`.

Types are maintained exclusively via `Supabase:generate_typescript_types` MCP tool after every migration. CLI not installed. No drift diff step.

Fix flow: `generate_typescript_types` → write `types/supabase.ts` → `tsc --noEmit` → commit.

---

## 5. Releases

| Version | Date | Notes |
|---|---|---|
| v2.0.1 | 2026-03-23 | SEQ221: guides stale state fix, cover image upload fix. SEQ222: canvas 1280px sitewide. |
| v2.0.2 | 2026-03-23 | SEQ223: theme system overhaul. SEQ224: navbar dark mode, lg breakpoint fix. |
| v2.0.3 | 2026-03-24 | Phase A: architecture docs, SHAPE step, CONTEXT/LOOKUP split, CLAUDE.md trim. |

### Pending issues
- ISS-0043 (SEQ221): Navbar dark mode contrast — resolved in SEQ224, open for close.
- SEQ241-243: Vital signs feature — on hold pending SO clarification on state model.
