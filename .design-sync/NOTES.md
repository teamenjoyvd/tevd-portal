# design-sync notes for tevd-portal

## Repo shape

tevd-portal is **not a design-system package** — there's no Storybook, no library
build, no `package.json` `main`/`module`/`exports`. The synced "design system" is
`components/ui/` (12 shadcn/ui + Radix wrapper files), scoped via `cfg.srcDir`.
The converter's "package" shape was run in **synth-entry mode**: `--entry` points
at a nonexistent path (`./components/ui/__synth_entry__.js`) purely so the
converter walks up to the repo's real `package.json` (name `tevd-portal`) for
`PKG_DIR`; there's no real dist to bundle, so it falls back to scanning
`components/ui/*.tsx` directly, discovering 62 PascalCase exports across the 12
files.

## Custom CSS build step

There's no compiled stylesheet anywhere in this repo (Tailwind v4, JIT, compiled
at Next build time only). `cfg.buildCmd` (`node .design-sync/scripts/compile-css.mjs`)
compiles a scoped stylesheet via `@tailwindcss/postcss`, `@source`-scoped to
`components/ui/**/*.tsx`, plus `styles/brand-tokens.css` (the repo's real design
tokens — not Tailwind `@theme` — see conventions.md). Output:
`.design-sync/.cache/tw-compiled.css`, wired via `cfg.cssEntry`. **Run this before
every rebuild** — `package-build.mjs` reads it as a static file, it does not
compile Tailwind itself.

## Known render fixes applied during preview authoring

- **`DropdownMenu`/`Popover`**: the trigger button was originally extracted into a
  small `Avatar()` helper function component. Radix's `asChild` needs to attach a
  `ref` to the real DOM node for Popper anchor measurement — a plain function
  component silently drops that ref, and the popper renders stuck at its internal
  placeholder position (observed as `transform: translate(0px, -200%)`, fully
  off-screen). Fixed by inlining the `<button>` directly. **If a preview trigger
  is ever extracted into a helper component again, wrap it in
  `React.forwardRef`** or this will silently break.
- **`DropdownMenu`/`Popover`**: also pinned `side="bottom"` explicitly — Radix's
  collision flip was placing content above the trigger in the small (~320px)
  preview viewport.
- **`Toaster`** (sonner): the toast list is `position: fixed`, contributing zero
  height to the document flow. The capture harness's `fullPage` screenshot
  measures document scroll height, which collapsed to ~0. Fixed with an explicit
  `minHeight: '100vh'` filler div in the preview. Also set `duration: Infinity`
  on the toasts so they don't auto-dismiss before capture, and neutralized CSS
  transitions (`[data-sonner-toaster] * { transition: none !important }`) so the
  entrance animation doesn't get caught mid-transition.
- **`VaulDrawer`**: same transition-timing issue — neutralized `[data-vaul-drawer]`
  transform/transition for the static capture.
- **`Dialog`**: `DialogOverlay` (this repo's fork) ships with no background color
  of its own — every real call site (`CalendarClient.tsx`) passes one explicitly.
  The preview does the same.

## Known render warns (pre-triaged, not new)

None currently — final validate run was fully clean (0 bad, 0 thin, 0
variantsIdentical) across all 62 components.

## Preview scope

Only the 12 "group root" components got authored previews (Dialog, AlertDialog,
Popover, Select, Sheet, DropdownMenu, Tabs, Table, Drawer, VaulDrawer, Toaster,
Skeleton), plus 4 leaf sub-components that rendered blank alone and needed their
parent's full composition (`SheetHeader`, `TableCaption`, `TableCell`,
`TableHead` — each duplicates its group's preview). The remaining 46 exports
(mostly Radix sub-parts like `DialogTrigger`, `TabsList`, `SelectItem`) are on
the floor card by design — they're real, importable, and documented via
`.d.ts`/`.prompt.md`, just not visually authored. Authorable incrementally on
any future re-sync.

## Re-sync risks

- **`compile-css.mjs` must run before every rebuild** (see above) — a bare
  `package-build.mjs` run without it first will pick up a stale
  `.design-sync/.cache/tw-compiled.css` (or none, on a fresh clone/gitignored
  cache miss).
- **Tailwind/token drift**: if `styles/brand-tokens.css` or the app's Tailwind
  version changes, `conventions.md`'s token table and the compiled CSS should be
  re-validated — nothing currently automates that cross-check beyond re-running
  the compile script and re-authoring/re-verifying conventions.md per the base
  skill's rebuild rule.
- **`components/ui/*.tsx` real source-code gaps** (not sync bugs, but worth
  knowing): `table.tsx` references `text-muted-foreground` and `hover:bg-muted/50`
  — neither `muted`/`muted-foreground` is a defined color anywhere in this
  repo's Tailwind config, so those classes are dead/no-ops. `tabs.tsx` similarly
  references `ring-ring` with no `ring` token defined. Not fixed here (out of
  sync scope — this only converts existing source, never rewrites it), but a
  future full re-verify of `Table`/`Tabs` previews should not be surprised these
  classes render as nothing.
- **No Storybook reference exists** — every grade in this run is absolute
  (rubric-based), not diffed against a repo-owned reference render. A future
  re-sync's `[SPOT_CHECK]` canary re-verification is the only cross-check.
