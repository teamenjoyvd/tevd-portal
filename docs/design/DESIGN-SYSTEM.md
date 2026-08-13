# Design System

Living reference for the tevd-portal visual system. Seeded by #611 (Tailwind v4
config repair). Extend as surfaces are documented.

## How styling is wired

Tailwind **v4**, configured entirely in CSS — there is **no `tailwind.config.ts`**
(v4 auto-detects content; a config file is silently ignored unless imported with
`@config`, which this project deliberately does not do).

- `app/globals.css` — `@import 'tailwindcss'`, then `@import 'tw-animate-css'`
  (overlay animations), then the `@theme` block that registers design tokens as
  utilities, then project component CSS.
- `styles/brand-tokens.css` — runtime CSS custom properties (`--brand-*`,
  semantic `--bg-*`/`--text-*`, bento tokens) and the `[data-theme="dark"]`
  overrides. Imported after `globals.css` in `app/layout.tsx`.

`@theme` tokens generate utilities at build time; `brand-tokens.css` vars are
consumed at runtime (including via inline `style` and `.card--*` classes). The
two overlap in name but serve different layers — keep brand hexes in sync
between them.

## Tokens

Brand palette (canonical hexes; registered in `@theme` as `--color-brand-*`,
mirrored as runtime vars in `brand-tokens.css` as `--brand-*`):

| Token | Hex | Utility example |
|---|---|---|
| forest | `#2d332a` | `bg-brand-forest` |
| crimson | `#bc4749` | `text-brand-crimson` |
| teal | `#3e7785` | `bg-brand-teal` |
| sienna | `#e07a5f` | `text-brand-sienna` |
| parchment | `#faf8f3` | `text-brand-parchment` |
| void | `#1a1f18` | `bg-brand-void` |
| oyster | `#f0ede6` | `bg-brand-oyster` |
| moss | `#252b23` | `bg-brand-moss` |
| stone | `#8a8577` | `text-brand-stone` |

Semantic/surface tokens (`--bg-global`, `--bg-card`, `--text-primary`, …) and
their dark-mode overrides live in `styles/brand-tokens.css`. The dark
`--bg-global-rgb` **must** stay `26, 31, 24` — the header backdrop `rgba()`
depends on it.

## Typography

Fonts load via `next/font/google` in `app/layout.tsx`, each exposing a CSS
variable on `<html>`. The `@theme` block chains those variables to font
utilities:

| Utility | `@theme` token | Font | next/font var |
|---|---|---|---|
| `font-display` | `--font-display` | Cormorant Garamond | `--font-cormorant` |
| `font-body` | `--font-body` | Montserrat | `--font-montserrat` |
| `font-serif` | `--font-serif` | Playfair Display | `--font-playfair` |
| `font-sans` | `--font-sans` | Montserrat | `--font-montserrat` |

`<body>` defaults to `font-body` (Montserrat). DM Sans was removed; the remaining
fonts have real usage in the app.

## Rounding

**Two tiers, held at 2:1 — containers 8px, controls 4px.**

| Tier | Value | Token | Utility | What it covers |
|---|---|---|---|---|
| Container | **8px** | `--radius` | `rounded-container` | Cards, tiles, dialogs, sheets, popovers, menus, list rows, panels, images, skeleton blocks, the navbar shell |
| Control | **4px** | `--radius-control` | `rounded-control` | Pills, badges, chips, buttons, inputs, selects, tabs |

Both live in `styles/brand-tokens.css`. Directional variants work
(`rounded-t-container` for the mobile bottom sheet).

### Why not one value

An earlier revision of this section mandated a single 16px radius. It was
wrong, and the reason is worth keeping because it is not obvious:

> **CSS clamps corner radii.** When the two radii on a side exceed that side's
> length, *every* radius scales down by the same factor (CSS Backgrounds 3
> §5.5). For a uniform radius the rendered corner is
> `min(r, width/2, height/2)`.

A status badge is **19px tall**. At 16px it renders at 9.5px — exactly half its
height, which is a capsule. At 12px it is *still* a capsule. No value at or
above ~9px changes that badge at all, so "one radius site-wide" silently meant
"cards get 16px and every pill stays a lozenge".

8px and 4px were chosen so that **nothing clamps anywhere** — every element
renders exactly the value set — and the 2:1 gap is what makes a badge read as
nested inside its card. If you change these, keep the ratio, and keep the
control value below half the height of the shortest badge.

### Writing it

Use the **named** utilities. A bare `rounded-xl` never said which kind of thing
it was on, which is exactly how four scales drifted into the codebase:

```tsx
<div className="rounded-container p-4">   {/* a surface     */}
  <span className="rounded-control px-2">  {/* an interactive */}
```

Never write a numeric radius (`10px`, `0.5rem`, `9999px`) in a component.

`--radius-md`, `--radius-lg` and `--radius-xl` are pinned to the **control**
tier and `--radius-2xl` to the container tier. That is a **legacy landing zone**
so unmigrated code lands somewhere sane — not a scale. Do not reach for
`rounded-md/lg/xl/2xl` in new code.

### The only exceptions

- **`rounded-full`** — circular affordances *only*: avatars and logos
  (`Footer.tsx`, `Header.tsx`), the calendar today-dot (`MonthView.tsx`),
  progress tracks (`AttendeeView.tsx`), `ui/switch.tsx`, spinners, the drawer
  drag handle (`ui/vaul-drawer.tsx`), dialog close buttons, and notification
  count dots (`BellButton.tsx`). A status pill or badge is **not** one of
  these — those are `rounded-control`.
- **`rounded-sm`** (`--radius-sm`, 2px) — hairline chrome only. Not cards, not pills.
- Tiptap **rendered content** styles in `globals.css` are author content, not
  app chrome, and keep their own radii.

### Radius Bench

`docs/design/radius-bench.html` — open it in a browser. It renders every
surface in the portal at an adjustable radius, light and dark side by side, and
reports each specimen's measured height, the radius requested, and the radius
actually rendered after clamping. Use it before changing either value; a
radius decision cannot be reviewed as a diff.

### Migration status

`app/admin/**` has not been migrated (2608-DEV-740 Phase 1 covered
`components/`, `app/(dashboard)/` and `app/events/`). Admin pills still use
`rounded-full` and some admin containers still sit on `rounded-lg`/`rounded-xl`,
so they render at the control tier. Tracked as the Phase 2 follow-up.

## Elevation Shadows

Hierarchical shadow system for layering UI surfaces. All shadows are defined in
`styles/brand-tokens.css` as CSS custom properties and consumed via inline
`style` props in shadcn components:

| Token | Usage | Hex values |
|---|---|---|
| `--shadow-rest` | Default card state, low elevation | `0 1px 2px rgba(45, 51, 42, 0.04), 0 2px 8px rgba(45, 51, 42, 0.04)` |
| `--shadow-hover` | Hover state of interactive cards (`.interactive-lift` class) | `0 2px 4px rgba(45, 51, 42, 0.05), 0 12px 24px -8px rgba(45, 51, 42, 0.10)` |
| `--shadow-modal` | Overlay surfaces (dialog, sheet, popover, dropdown) | `0 4px 12px rgba(26, 31, 24, 0.08), 0 24px 48px -12px rgba(26, 31, 24, 0.18)` |

Dark mode redefines the same token names with the same blur/offset geometry, tint swapped from the light forest base to the dark `--brand-void` base at roughly 3x the alpha — a shadow needs more opacity to read against a dark surface.

## Component States

### Status pills

Semantic status tokens in `styles/brand-tokens.css`, each a `bg`/`fg` pair with
real `[data-theme="dark"]` overrides — consumed via inline `style` in
`components/admin/StatusPill.tsx` and `app/(dashboard)/profile/components/StatusBadge.tsx`,
not Tailwind `dark:` classes (see Usage rules below for why):

| Token | Light `bg` / `fg` | Dark `bg` / `fg` | Used for |
|---|---|---|---|
| `--status-success` | `rgba(63,107,74,.12)` / `#2f5138` | `rgba(127,184,143,.18)` / `#9fd6ae` | `sent` |
| `--status-info` | `rgba(62,119,133,.12)` / `#2c5964` | `rgba(94,168,184,.18)` / `#8fd0dd` | `claimed` |
| `--status-alert` | `rgba(188,71,73,.12)` / `#96393b` | `rgba(224,110,112,.18)` / `#f19a9b` | `failed`, `permanently_failed` |
| `--status-pending` | `rgba(224,122,95,.14)` / `#a3502e` | `rgba(232,150,120,.20)` / `#f0b08d` | `pending` (default) |
| `--status-neutral` | `rgba(138,133,119,.15)` / `#5c5950` | `rgba(181,176,168,.20)` / `#B5B0A8` | `cancelled`, `revoked` |

5 semantic tokens cover 7 status values — `failed` and
`permanently_failed` share `--status-alert`, `cancelled` and `revoked` share
`--status-neutral`, distinguished by label text only.

## Animation

### Skeleton Shimmer

Placeholder animation for loading states. Uses `.skeleton-shimmer` class (defined
in `app/globals.css`) with a 2-second ease-in-out loop. The animation respects
`prefers-reduced-motion`.

```css
@keyframes skeleton-shimmer {
  0% { background-color: var(--skeleton-base); }
  50% { background-color: var(--skeleton-base); opacity: 0.5; }
  100% { background-color: var(--skeleton-base); }
}
```

### Reduced Motion

All animations (bento entrance, skeleton shimmer, interactive lifts) are disabled
when `prefers-reduced-motion: reduce` is set in the user's OS accessibility
settings. Applied via `@media (prefers-reduced-motion: reduce)` guard in
`app/globals.css`.

## Usage Rules

- **Never use Tailwind's `dark:` variant for theme-conditional styling.** This
  project toggles a `data-theme="dark"|"light"` attribute on `<html>`
  (`lib/hooks/useTheme.ts`), not `prefers-color-scheme` or a `.dark` class —
  and no `@custom-variant dark` remaps it. `dark:*` utility classes silently
  never fire. Use CSS custom properties with a `[data-theme="dark"] { ... }`
  override block instead (see `styles/brand-tokens.css` for the pattern), or
  read `data-theme` at runtime for JS-driven values (`lib/hooks/useTheme.ts`
  exposes it; `ThemeTile.tsx` is the reference consumer).
- **Legacy bare token names** (`--forest`, `--crimson`, `--sienna`, `--stone`,
  defined in `app/globals.css`) are a deliberate back-compat layer for older
  calendar components (`FilterControls.tsx`, `MonthView.tsx`, `AgendaView.tsx`,
  `AdminCalendarClient.tsx`) — their hex values are kept in sync with the
  `--brand-*` tokens by convention, not by CSS reference. New code should use
  `--brand-*` / `--color-brand-*` directly; do not add new bare-name aliases.
