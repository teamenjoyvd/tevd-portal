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

## Elevation Shadows

Hierarchical shadow system for layering UI surfaces. All shadows are defined in
`styles/brand-tokens.css` as CSS custom properties and consumed via inline
`style` props in shadcn components:

| Token | Usage | Hex values |
|---|---|---|
| `--shadow-rest` | Default card state, low elevation | `0 1px 2px rgba(45, 51, 42, 0.04), 0 2px 8px rgba(45, 51, 42, 0.04)` |
| `--shadow-hover` | Hover state of interactive cards (`.interactive-lift` class) | `0 2px 4px rgba(45, 51, 42, 0.05), 0 12px 24px -8px rgba(45, 51, 42, 0.10)` |
| `--shadow-modal` | Overlay surfaces (dialog, sheet, popover, dropdown) | `0 4px 12px rgba(26, 31, 24, 0.08), 0 24px 48px -12px rgba(26, 31, 24, 0.18)` |

Dark mode uses the same token names with parchment-tinted values for consistency.

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
