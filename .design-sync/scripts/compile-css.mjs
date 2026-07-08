// tevd-portal has no design-system package build, so there is no shipped
// compiled stylesheet for design-sync's cssEntry to point at. This compiles
// one: Tailwind v4 scoped to components/ui/**, plus the repo's real token
// file (styles/brand-tokens.css), which is what components/ui actually reads
// via inline `style={{ color: 'var(--...)' }}` (see components/ui/dialog.tsx
// header comment — shadcn's default --background/--foreground vars were
// replaced with this repo's own token names).
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const entry = `
@import 'tailwindcss' source(none);
@source '${resolve(root, 'components/ui').replace(/\\/g, '/')}/**/*.tsx';
@import '${resolve(root, 'styles/brand-tokens.css').replace(/\\/g, '/')}';
`;

const result = await postcss([tailwindcss()]).process(entry, {
  from: resolve(root, '.design-sync/.cache/tw-entry.css'),
});

mkdirSync(resolve(root, '.design-sync/.cache'), { recursive: true });
writeFileSync(resolve(root, '.design-sync/.cache/tw-compiled.css'), result.css);
console.log(`wrote ${result.css.length} bytes to .design-sync/.cache/tw-compiled.css`);
