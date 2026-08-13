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
| `--focus-ring` | crimson | `#6FAEBE` | Focus rings |

`color-scheme` is set alongside them (`light` on `:root`, `dark` on
`[data-theme="dark"]`) so native scrollbars, `<select>` popups, date pickers
and autofill backgrounds follow the app theme.

### Contrast (WCAG 2.2 AA)

Measured, not estimated. AA is 4.5:1 for body text and 3:1 for large text and
UI components. Re-measure and update this table whenever a value changes.

| Pair | Light | Dark | Bar | |
|---|---|---|---|---|
| `--text-primary` on `--bg-card` | 14.33 | 13.66 | 4.5 | pass |
| `--text-secondary` on `--bg-card` | 5.99 | 6.72 | 4.5 | pass |
| `--link` on `--bg-global` | 5.85 | 6.76 | 4.5 | pass |
| `--link` on `--bg-card` | 5.31 | 5.85 | 4.5 | pass |
| `--link-hover` on `--bg-card` | 6.60 | 8.13 | 4.5 | pass |
| `--on-accent` on crimson / forest / teal | 4.78 / 12.22 / 4.73 | same | 4.5 | pass |
| `--focus-ring` on `--bg-global` / `--bg-card` | 4.78 / 4.34 | 6.76 / 5.85 | 3.0 | pass |
| `--status-success-fg` on `--bg-card` | 7.63 | 8.77 | 4.5 | pass |
| `--status-info-fg` on `--bg-card` | 6.60 | 8.45 | 4.5 | pass |
| `--status-alert-fg` on `--bg-card` | 6.10 | 6.79 | 4.5 | pass |
| `--status-pending-fg` on `--bg-card` | 4.80 | 7.80 | 4.5 | pass |
| `--status-neutral-fg` on `--bg-card` | 5.99 | 6.72 | 4.5 | pass |
| **`--text-tertiary` on `--bg-card`** | **3.15** | **3.94** | 4.5 | **FAIL — open** |

Two notes on why `--link` is not simply `var(--brand-teal)`:

- `--brand-teal` is 3.34:1 on the dark page — the AA failure this ticket was
  filed for.
- It is *also* 4.29:1 on the **light** card, a failure nobody had noticed.
  `--brand-teal` stays the brand **fill** colour; `--link` is for text.

`--text-tertiary` fails in both themes and is never redefined for dark at all.
Fixing it changes light-mode pixels, so it is deliberately **not** in the C1
foundation change — it belongs to the contrast-audit phase.

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
  `ThemeTile.tsx` is the reference consumer).
- **Legacy bare token names** (`--forest`, `--crimson`, `--sienna`, `--stone`,
  defined in `app/globals.css`) are a deliberate back-compat layer for older
  calendar components (`FilterControls.tsx`, `MonthView.tsx`, `AgendaView.tsx`,
  `AdminCalendarClient.tsx`) — their hex values are kept in sync with the
  `--brand-*` tokens by convention, not by CSS reference. New code should use
  `--brand-*` / `--color-brand-*` directly; do not add new bare-name aliases.
