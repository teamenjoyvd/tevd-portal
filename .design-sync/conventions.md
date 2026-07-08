## tevd-portal UI conventions

This library is not a standalone design-system package — it's the shadcn/ui + Radix primitives used directly inside the tevd-portal Next.js app (`components/ui/`). There is no build step of its own; this bundle was synthesized from the app's own source files.

### No provider or root wrapper needed

Nothing here reads from React context for styling. Colors come from plain CSS custom properties defined globally — no `ThemeProvider`, no context wrapper required to render correctly. Dark mode is a `data-theme="dark"` attribute toggle on an ancestor element (commonly `<html>`), not a React provider — the same components render correctly in either mode automatically once that attribute is set.

### Styling idiom: Tailwind for layout, CSS variables for color

Components mix two systems, and getting this right matters:

- **Structure/layout** — plain Tailwind utility classes (`flex`, `fixed`, `z-50`, `rounded-xl`, `px-4 py-2`, etc.).
- **Color** — inline `style={{ color: 'var(--text-primary)' }}` referencing real CSS custom properties, **not** Tailwind color utility classes. shadcn's usual `bg-background` / `text-foreground` / `border-input` classes were deliberately replaced in this fork — do not use them, they resolve to nothing here.

The real token names live in `styles/brand-tokens.css` and are compiled into `.design-sync/.cache/tw-compiled.css`:

| Token | Use |
|---|---|
| `--bg-global` | page/app background |
| `--bg-card` | card/surface/popover/menu background |
| `--text-primary` | primary text |
| `--text-secondary` | secondary/muted text |
| `--text-tertiary` | tertiary/placeholder text |
| `--border-default` | default border color |
| `--border-hover` | hover border color |
| `--brand-crimson`, `--brand-forest`, `--brand-teal`, `--brand-sienna` | brand accent colors (buttons, accents) |
| `--brand-parchment`, `--brand-void`, `--brand-oyster`, `--brand-moss` | dark-mode surface/background variants |

Build new layout/spacing with Tailwind utilities as normal; build all color with `style={{ ... : 'var(--token-name)' }}` using the table above.

### Gaps to compose around, not invent past

A few primitives in this fork ship with **no default visual styling** for pieces callers are expected to style themselves — this is a real repo quirk, confirmed against the source, not a bug in this sync:

- `DialogOverlay` (from `dialog.tsx`) has no background color at all — every real call site passes one explicitly, e.g. `<DialogOverlay style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} />`. Omit it and the overlay is fully transparent.
- Radix popper-based content (`DropdownMenuContent`, `PopoverContent`, `SelectContent`) inherits Radix's own `align`/`side` defaults (`align="end"`) — pick `align`/`side` deliberately based on where the trigger sits on screen, don't assume the default fits.

### Where the truth lives

- `_ds_bundle.css` (via `styles.css`'s `@import`) — the real compiled CSS and every token above.
- Each component's `.d.ts` and `.prompt.md` — the real prop shape and a working usage example.

### Example — composing a real component (AlertDialog)

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <button style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-default)', color: 'var(--brand-crimson)' }}>
      Delete trip
    </button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```
