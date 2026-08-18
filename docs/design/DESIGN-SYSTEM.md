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

### Tokens are Tailwind utilities

`app/globals.css` maps every semantic token into Tailwind's colour scale with
`@theme inline`, so you do **not** need an inline `style` object to use one:

| Instead of | Write |
|---|---|
| `style={{ backgroundColor: 'var(--bg-card)' }}` | `className="bg-bg-card"` |
| `style={{ color: 'var(--text-primary)' }}` | `className="text-text-primary"` |
| `style={{ color: 'var(--brand-teal)' }}` on a link | `className="text-link hover:text-link-hover"` |
| `hover:bg-black/[0.04]` | `hover:bg-hover-surface` |
| `rgba(255,255,255,0.9)` on a crimson fill | `text-on-accent` |

These are theme-aware for free. Opacity modifiers work (`bg-bg-card/50`
compiles to `color-mix(in oklab, var(--bg-card) 50%, transparent)`).

Adding a token: define it in **both** `:root` and `[data-theme="dark"]` in
`brand-tokens.css`, add one line to the `@theme inline` block, and record its
contrast ratio in the table below.

### Interaction tokens

Added in 2608-DEV-741 because there was no token for "a link", "a hover",
"text on a crimson fill" or "the dialog scrim" — so those were typed as colour
literals 513 times, and every one of them is wrong in dark mode.

| Token | Light | Dark | For |
|---|---|---|---|
| `--link` / `--link-hover` | `#356874` / `#2C5964` | `#6FAEBE` / `#93CBD8` | Text links |
| `--on-accent` | parchment | parchment | Text/icons on a crimson / forest / teal fill |
| `--overlay` | `rgba(26,31,24,.40)` | `rgba(0,0,0,.60)` | Dialog and sheet scrims |
| `--hover-surface` | `rgba(45,51,42,.05)` | `rgba(250,248,243,.08)` | Hover tints |
| `--on-accent-hover` | `rgba(255,255,255,.10)` | same | Hover wash on a fill that does not swap with theme (footer icon buttons) |
| `--on-accent-dark` | void | same | Text on a **light** accent fill (sienna, stone), where parchment fails AA |
| `--overlay-strong` | `rgba(0,0,0,.85)` | same | Image lightbox backdrop over an unknown photo |
| `--image-scrim` | forest-tinted gradient | black gradient | Text laid over a photo |
| `--focus-ring` | crimson | `#6FAEBE` | Focus rings |

`color-scheme` is set alongside them (`light` on `:root`, `dark` on
`[data-theme="dark"]`) so native scrollbars, `<select>` popups, date pickers
and autofill backgrounds follow the app theme.

### Contrast (WCAG 2.2 AA)

Measured, not estimated — every ratio below is computed from the actual token
values in `styles/brand-tokens.css`, compositing translucent tints over the
surface they sit on. AA is 4.5:1 for body text and 3:1 for large text and UI
components. **Nothing in this table is below its bar.** Re-measure and update
whenever a value changes.

**Foregrounds on the three surfaces** (`--bg-global` page, `--bg-card`,
`--bg-card-raised`):

| Token | Light (global / card / raised) | Dark (global / card / raised) | Bar | |
|---|---|---|---|---|
| `--text-primary` | 15.79 / 14.33 / 14.72 | 15.79 / 13.66 / 12.44 | 4.5 | pass |
| `--text-secondary` | 6.60 / 5.99 / 6.15 | 7.77 / 6.72 / 6.12 | 4.5 | pass |
| `--text-tertiary` | 5.47 / 4.96 / 5.10 | 5.75 / 4.98 / 4.53 | 4.5 | pass |
| `--text-nav` | 6.60 / 5.99 / 6.15 | 15.79 / 13.66 / 12.44 | 4.5 | pass |
| `--link` | 5.85 / 5.31 / 5.45 | 6.76 / 5.85 / 5.33 | 4.5 | pass |
| `--link-hover` | 7.27 / 6.60 / 6.78 | 9.40 / 8.13 / 7.40 | 4.5 | pass |
| `--focus-ring` | 4.78 / 4.34 / 4.46 | 6.76 / 5.85 / 5.33 | 3.0 | pass |
| `--status-success-fg` on card | 7.63 | 8.77 | 4.5 | pass |
| `--status-info-fg` on card | 6.60 | 8.45 | 4.5 | pass |
| `--status-alert-fg` on card | 6.10 | 6.79 | 4.5 | pass |
| `--status-pending-fg` on card | 5.54 | 7.80 | 4.5 | pass |
| `--status-neutral-fg` on card | 5.99 | 6.72 | 4.5 | pass |

**Designed pairs** — each foreground on the fill it is meant for, which is the
ratio that actually ships:

| Pair | Light | Dark | Bar | |
|---|---|---|---|---|
| `--status-success-fg` on `--status-success-bg` | 6.51 | 6.22 | 4.5 | pass |
| `--status-info-fg` on `--status-info-bg` | 5.72 | 6.25 | 4.5 | pass |
| `--status-alert-fg` on `--status-alert-bg` | 5.22 | 5.30 | 4.5 | pass |
| `--status-pending-fg` on `--status-pending-bg` | 4.90 | 5.38 | 4.5 | pass |
| `--status-neutral-fg` on `--status-neutral-bg` | 5.18 | 4.50 | 4.5 | pass |
| `--on-accent` on `--brand-crimson` | 4.78 | 4.78 | 4.5 | pass |
| `--on-accent` on `--brand-forest` | 12.22 | 12.22 | 4.5 | pass |
| `--on-accent` on `--brand-teal` | 4.73 | 4.73 | 4.5 | pass |
| `--on-accent-dark` on `--brand-sienna` | 5.68 | 5.68 | 4.5 | pass |
| `--on-accent-dark` on `--brand-stone` | 4.55 | 4.55 | 4.5 | pass |

The four rows the audit (2608-DEV-741 C4) had to **change**, not just record:

- `--text-tertiary` was `#8A8577`: 3.15 on the light card, 3.94 on the dark one,
  and never redefined for dark at all. Now `#6A6559` light / `#9C978A` dark.
- `--status-pending-fg` was `#a3502e`: 4.25 on its own tint, the only status
  pair that failed. Now `#96481f`.
- `--on-accent` on `--brand-sienna` (2.78) and `--brand-stone` (3.47) — parchment
  on a *light* fill never had a chance. Those two call sites (the admin calendar
  category badge, the "completed" trip badge) now use `--on-accent-dark`.
- Brand colours **as text**: `--brand-crimson` is 2.86:1 and `--brand-teal`
  2.89:1 on the dark card — below even the 3:1 UI bar. All 127 `color:
  var(--brand-crimson|teal)` call sites moved to `--status-alert-fg` / `--link`.
  The only exception is the **TEAMENJOY*VD*** wordmark, which WCAG 1.4.3 exempts
  as a logotype; it keeps the brand hex in `Header.tsx` and `Footer.tsx`.

Two notes on why `--link` is not simply `var(--brand-teal)`:

- `--brand-teal` is 3.34:1 on the dark page — the AA failure this ticket was
  filed for.
- It is *also* 4.29:1 on the **light** card, a failure nobody had noticed.
  `--brand-teal` stays the brand **fill** colour; `--link` is for text.

### The check that keeps this true

`npm run check:colors` (`scripts/check-color-literals.js`, a CI job of its own)
fails the build on:

1. a hex, `rgb()/rgba()/hsl()/hsla()`, or a bare `'white'`/`'black'` in `app/`
   or `components/` — `rgba(var(--token-rgb), a)` is the sanctioned form when a
   variable alpha has to be composited in JS;
2. a Tailwind palette class — `text-emerald-800`, `bg-gray-200`,
   `hover:bg-black/5`, `text-white`. These were the cheap wrong path: one word,
   versus a whole style object for the correct one;
3. a `var(--x)` that no stylesheet defines. This is not a CSS error — an
   undefined custom property silently computes to nothing, so it renders
   transparent and nobody finds out. Three separate families of these were
   live when the check was written: `--bg-base` (the mobile payment footer),
   `--semantic-fg-*` and `--border-subtle` (26 uses across the two email-settings
   components), and `--primary-default` / `--text-muted` / `--border` /
   `--bg-subtle` (roles, admin calendar, LOS preview).

Genuine exceptions carry a reason inline:

```tsx
// colour-literal-ok: <why this cannot be a token>
```

and the file-level allowlist in the script itself covers the Clerk shadow DOM
(CSS variables do not cross it) and the jsPDF export route (a PDF canvas has no
CSS at all).

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

**Radius:** `app/admin/**` has not been migrated (2608-DEV-740 Phase 1 covered
`components/`, `app/(dashboard)/` and `app/events/`). Admin pills still use
`rounded-full` and some admin containers still sit on `rounded-lg`/`rounded-xl`,
so they render at the control tier. Tracked as the Phase 2 follow-up.

**Colour:** complete. 2608-DEV-741 finished the migration across `app/` and
`components/` — 329 literals in 73 files, plus ~176 Tailwind palette classes and
39 dangling `var()` references. `npm run check:colors` holds the line.

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

- **Colour goes through tokens. `dark:` is only for what a token cannot
  express.** *(Revised in 2608-DEV-741 — this rule previously banned `dark:`
  outright.)*

  `@custom-variant dark (&:where([data-theme="dark"] *))` is now registered in
  `app/globals.css`, so `dark:` targets the app's own `data-theme` attribute.
  The old blanket ban was aimed at a real bug but described it wrongly: an
  unregistered `dark:` did not "silently never fire", it fired on the **OS**
  setting — an intermittent bug, which is worse than an absent one.

  So the rule is now narrower and enforceable, not looser:
  - **Colour** — always a semantic token. Never `dark:text-white`, never a hex.
  - **`dark:`** — only for non-colour properties a token cannot carry: shadow
    geometry, `opacity`, image `filter`, `background-image` gradients.

  For JS-driven values, read `data-theme` at runtime (`lib/hooks/useTheme.ts`;
  `ThemeTile.tsx` is the reference consumer). As of 2608-DEV-741 C2 there are
  **zero** `dark:` classes in `app/` and `components/` — all five that existed
  were colour, and colour is now a token. The variant stays registered for the
  non-colour cases above.
- **Brand colours are fills, not text.** `--brand-crimson` measures 2.86:1 and
  `--brand-teal` 2.89:1 as text on the dark card. For coloured *text* use
  `--status-alert-fg`, `--status-info-fg` or `--link`. The wordmark is the one
  exception (WCAG 1.4.3 exempts logotypes).
- **Text on a fill picks its foreground from the fill's lightness.** Dark fills
  (crimson, forest, teal) take `--on-accent`; light fills (sienna, stone) take
  `--on-accent-dark`. An inverted fill — `backgroundColor: var(--text-primary)`
  — takes `var(--bg-global)`, never `white`: in dark mode `--text-primary` *is*
  parchment, so white-on-white was a real bug in six filter pills.
- **`npm run check:colors` enforces all of the above** and runs as its own CI
  job. See § The check that keeps this true. Do not silence it with a pragma
  unless the reason is that CSS variables genuinely cannot reach the value
  (Clerk's shadow DOM, a PDF canvas, a numeric blend constant).
- **Legacy bare token names** (`--forest`, `--crimson`, `--sienna`, `--stone`,
  defined in `app/globals.css`) are a deliberate back-compat layer for older
  calendar components (`FilterControls.tsx`, `MonthView.tsx`, `AgendaView.tsx`,
  `AdminCalendarClient.tsx`) — their hex values are kept in sync with the
  `--brand-*` tokens by convention, not by CSS reference. New code should use
  `--brand-*` / `--color-brand-*` directly; do not add new bare-name aliases.
