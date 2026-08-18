#!/usr/bin/env node
"use strict";

/**
 * Colour-literal gate — 2608-DEV-741 C5.
 *
 * Fails the build on a hardcoded colour written into a `style` prop (or any
 * other string) inside app/ and components/. The token system only survives if
 * the shortest path stays the correct one: `style={{ color: '#bc4749' }}` is
 * one grep away from being reintroduced, and every instance of it is a
 * dark-mode bug that nothing else catches — a wrong-but-plausible colour
 * renders fine in CI and looks broken only to a human in dark mode.
 *
 * What counts as a violation:
 *   - a hex colour of 3/4/6/8 digits  (#bc4749, #fff, #1A1F18CC)
 *   - rgb()/rgba()/hsl()/hsla() whose first argument is not `var(--…)`
 *
 * `rgba(var(--brand-void-rgb), 0.4)` is the sanctioned escape hatch for a
 * variable alpha composited in JS (template literals cannot call color-mix),
 * so it passes.
 *
 * Escape hatch for a genuine exception: put
 *     // colour-literal-ok: <reason>
 * on the line itself or the line above. The reason is mandatory — an
 * unexplained pragma is the same silent drift this check exists to stop.
 *
 * Usage: node scripts/check-color-literals.js [--list]
 *   --list  print every violation without failing (migration aid)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ROOTS = ["app", "components"];
const EXTS = [".ts", ".tsx"];
const IGNORE_DIRS = ["node_modules", ".next", ".git", "coverage", "dist"];

/**
 * Files that must keep literal colours. Each entry needs a reason — the list
 * is the documented boundary of the token system, not a dumping ground.
 */
const ALLOWLIST = [
  {
    file: "app/(auth)/sign-in/[[...sign-in]]/page.tsx",
    reason: "Clerk renders into a shadow DOM; CSS custom properties do not cross it, so its appearance object must carry literal hexes.",
  },
  {
    file: "app/(auth)/sign-up/[[...sign-up]]/page.tsx",
    reason: "Clerk shadow DOM — same as sign-in.",
  },
  {
    file: "app/api/profile/event-shares/export/route.ts",
    reason: "jsPDF draws to a PDF canvas, not the DOM; it has no access to CSS variables and the output is theme-independent by definition.",
  },
];

const ALLOWED = new Set(ALLOWLIST.map((e) => e.file));

// A hex colour, but only at the real lengths: this must not fire on `#115`
// (a PR reference in a comment) or on a 5-digit id.
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;
// rgb/rgba/hsl/hsla NOT fed from a token. `rgba(var(--x-rgb), .5)` is fine, and
// so is `rgba(${ACCENT_RGB}, .5)` — the interpolated constant holds the var().
const FUNC = /\b(?:rgba?|hsla?)\(\s*(?!var\(--|\$\{)/;
// `backgroundColor: 'white'` is the same defect as a hex and was a real bug:
// a white input on a card that darkens leaves the input white.
const NAMED = /(?:color|backgroundColor|background|border(?:Color|Top|Bottom|Left|Right)?|fill|stroke)\s*:\s*'(?:white|black)'|\?\s*'(?:white|black)'\s*:/;
// Tailwind's own palette, which is off-brand AND theme-blind: `text-emerald-800`
// is one word while the correct thing used to be a whole style object. That
// asymmetry is what #741 exists to remove, so the class form has to fail too.
const TW_PALETTE =
  /\b(?:hover|focus|active|group-hover|dark|disabled|focus-visible):?(?::)?(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow)-(?:white|black|slate|gray|zinc|neutral|red|orange|amber|yellow|lime|green|emerald|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/(?:\d+|\[[\d.]+\]))?\b|\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow)-(?:white|black|slate|gray|zinc|neutral|red|orange|amber|yellow|lime|green|emerald|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/(?:\d+|\[[\d.]+\]))?\b/;
const PRAGMA = /colour-literal-ok:\s*\S/;

function walkFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results; // unreadable directory — skip
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.includes(entry.name)) continue;
      results.push(...walkFiles(full));
    } else if (EXTS.some((e) => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

/**
 * A pragma counts when it is on the line itself or anywhere in the contiguous
 * comment block directly above it — the reason usually needs more than one
 * line, and a reason that has to fit on one line is a reason nobody writes.
 */
function hasPragma(lines, i) {
  if (PRAGMA.test(lines[i])) return true;
  for (let j = i - 1; j >= 0 && isCommentLine(lines[j]); j--) {
    if (PRAGMA.test(lines[j])) return true;
  }
  return false;
}

function scanFile(absPath) {
  const rel = path.relative(ROOT, absPath).split(path.sep).join("/");
  if (ALLOWED.has(rel)) return [];

  const lines = fs.readFileSync(absPath, "utf8").split(/\r?\n/);
  const hits = [];
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Block comments run past their opening line, and prose inside them says
    // things like "#721" that look exactly like a 3-digit hex.
    const opens = line.lastIndexOf("/*");
    const closes = line.lastIndexOf("*/");
    const wasInBlock = inBlockComment;
    if (inBlockComment) {
      if (closes > -1) inBlockComment = false;
    } else if (opens > -1 && closes < opens) {
      inBlockComment = true;
    }
    if (wasInBlock) continue;
    if (isCommentLine(line)) continue;
    if (!HEX.test(line) && !FUNC.test(line) && !NAMED.test(line) && !TW_PALETTE.test(line))
      continue;
    if (hasPragma(lines, i)) continue;
    hits.push({ file: rel, line: i + 1, text: line.trim() });
  }
  return hits;
}

/**
 * Every `var(--x)` in app/ and components/ must resolve to a declaration in the
 * two stylesheets that define the system. An undefined custom property is not a
 * CSS error — it silently computes to nothing, so `backgroundColor:
 * var(--bg-base)` renders transparent and nobody finds out. Both defects this
 * check was written against (`--bg-base`, `--semantic-fg-*`) shipped that way.
 */
function scanUndefinedVars(files) {
  const declared = new Set();
  for (const sheet of ["styles/brand-tokens.css", "app/globals.css"]) {
    const abs = path.join(ROOT, sheet);
    if (!fs.existsSync(abs)) continue;
    const css = fs.readFileSync(abs, "utf8");
    for (const m of css.matchAll(/(^|[\s;{])(--[a-zA-Z0-9-]+)\s*:/g)) declared.add(m[2]);
  }
  // Set on <html> by next/font and the theme script rather than in a stylesheet.
  for (const runtime of ["--font-montserrat", "--font-playfair", "--font-cormorant", "--font-sora"])
    declared.add(runtime);

  const bad = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    const src = fs.readFileSync(abs, "utf8");
    // Props the file sets on the element itself (`style={{ '--col-span': n }}`)
    // are legitimately local and never live in a stylesheet.
    // Two local forms: a style object key, and Tailwind's arbitrary property
    // (`[--col-offset:0] md:[--col-offset:1]`).
    const local = new Set([
      ...[...src.matchAll(/'(--[a-zA-Z0-9-]+)'\s*:/g)].map((m) => m[1]),
      ...[...src.matchAll(/\[(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]),
    ]);
    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/var\((--[a-zA-Z0-9-]+)([^)]?)/g)) {
        const [, name, next] = m;
        // `var(--status-${kind}-bg)` — the name is composed at runtime.
        if (next === "$") continue;
        // Set by the component library at runtime, not by our stylesheets.
        if (name.startsWith("--radix-")) continue;
        if (local.has(name) || declared.has(name)) continue;
        bad.push({ file: rel, line: i + 1, name });
      }
    });
  }
  return bad;
}

function main() {
  const listOnly = process.argv.includes("--list");

  const files = ROOTS.flatMap((r) => walkFiles(path.join(ROOT, r)));
  const violations = files.flatMap(scanFile);

  const undefinedVars = scanUndefinedVars(files);
  if (undefinedVars.length > 0) {
    console.log(
      `${listOnly ? "" : "❌ "}${undefinedVars.length} reference(s) to undefined CSS custom properties ` +
        `(these render as nothing, in both themes):\n`
    );
    for (const v of undefinedVars) console.log(`  ${v.file}:${v.line}  ${v.name}`);
    console.log(
      "\nDefine the token in styles/brand-tokens.css (both :root and " +
        '[data-theme="dark"]) and map it in app/globals.css, or point the call site ' +
        "at the token that already exists.\n"
    );
  }

  if (violations.length === 0) {
    if (undefinedVars.length === 0) {
      console.log(`✅ No hardcoded colour literals in ${ROOTS.join("/, ")}/ (${files.length} files scanned).`);
    }
    return listOnly || undefinedVars.length === 0 ? 0 : 1;
  }

  const byFile = new Map();
  for (const v of violations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }

  console.log(
    `${listOnly ? "" : "❌ "}${violations.length} hardcoded colour literal(s) in ${byFile.size} file(s):\n`
  );
  for (const [file, hits] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${file} (${hits.length})`);
    for (const h of hits) {
      console.log(`    ${h.line}: ${h.text.slice(0, 120)}`);
    }
  }

  if (listOnly) return 0;

  console.log(
    "\nColour goes through tokens. Use a Tailwind utility (bg-bg-card, text-link,\n" +
      "hover:bg-hover-surface) or `var(--token)` in a style prop — see\n" +
      "docs/design/DESIGN-SYSTEM.md § Usage Rules. Need a variable alpha in JS?\n" +
      "Use rgba(var(--token-rgb), a). No token fits? Add one to\n" +
      "styles/brand-tokens.css (both themes) and app/globals.css, don't inline a hex."
  );
  return 1;
}

process.exit(main());
