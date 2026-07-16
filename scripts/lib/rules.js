"use strict";

// Pure rule predicates shared by scripts/validate-rules.js (repo-wide walk)
// and scripts/claude-hooks/dispatch.js (per-tool-call hook). Keep these
// side-effect free and fast: no fs, no child_process, no git.

/** Forbidden patterns inside middleware.ts (only clerkMiddleware is allowed). */
const MIDDLEWARE_FORBIDDEN = [
  { pattern: /NextResponse\.rewrite/, label: "NextResponse.rewrite" },
  { pattern: /NextResponse\.redirect/, label: "NextResponse.redirect" },
  { pattern: /\.headers\.set\s*\(/, label: "manual header manipulation (.headers.set)" },
  { pattern: /\.headers\.append\s*\(/, label: "manual header manipulation (.headers.append)" },
];

/** Returns labels of forbidden middleware patterns found in content. */
function middlewareViolations(content) {
  return MIDDLEWARE_FORBIDDEN.filter(({ pattern }) => pattern.test(content)).map(
    ({ label }) => label
  );
}

/** True when the path (posix-normalized) is a middleware.ts file. */
function isMiddlewarePath(filePath) {
  return /(^|\/)middleware\.ts$/.test(filePath);
}

/** True when content marks a client component ('use client' directive). */
function isClientComponent(content) {
  return content.includes("'use client'") || content.includes('"use client"');
}

/** True when client-side content references the service-role key. */
function serviceRoleLeak(content) {
  return isClientComponent(content) && content.includes("SUPABASE_SERVICE_ROLE_KEY");
}

/** True when the service-role key is assigned to a NEXT_PUBLIC_ variable. */
function serviceRoleInPublicEnv(content) {
  return /NEXT_PUBLIC_\w+\s*[=:]\s*[^;\n]*SERVICE_ROLE/.test(content);
}

/** True when a migration file body carries a -- ROLLBACK: comment. */
function hasRollbackComment(content) {
  return /--\s*ROLLBACK:/i.test(content);
}

/**
 * Branch naming: dev/[YYMM]-DEV-<slug> or claude/<slug>.
 * Suffix after DEV- is intentionally lenient (real branches include
 * dev/2607-DEV-546 and dev/2607-DEV-design-sync).
 */
const BRANCH_NAME_RE = /^(dev\/\d{4}-DEV-[\w][\w.-]*|claude\/[\w][\w.\/-]*)$/;

function isValidBranchName(name) {
  if (name === "main" || name === "master") return true;
  return BRANCH_NAME_RE.test(name);
}

/**
 * Migration filename rule (docs/ai/GOTCHAS.md): YYYYMMDDNNNN00_description.sql
 * — a 14-digit version where the last six digits are a zero-padded counter
 * (000000, 000100, 000200 …), NOT wall-clock HHMMSS. The CLI takes the digits
 * before the first underscore as the ledger version, so the older
 * YYYYMMDD_NNN form truncates to just the date and collides across same-day
 * files (the 2026-07-14 DEV ledger repair was cleaning up exactly that).
 */
const MIGRATION_FILENAME_RE = /^\d{8}(?:00\d{2}00|000000)_[a-z0-9_]+\.sql$/;

function isValidMigrationFilename(fileName) {
  return MIGRATION_FILENAME_RE.test(fileName);
}

/** True when the posix-normalized path is inside supabase/migrations/. */
function isMigrationPath(filePath) {
  return /(^|\/)supabase\/migrations\/[^/]+\.sql$/.test(filePath);
}

module.exports = {
  MIDDLEWARE_FORBIDDEN,
  middlewareViolations,
  isMiddlewarePath,
  isClientComponent,
  serviceRoleLeak,
  serviceRoleInPublicEnv,
  hasRollbackComment,
  BRANCH_NAME_RE,
  isValidBranchName,
  MIGRATION_FILENAME_RE,
  isValidMigrationFilename,
  isMigrationPath,
};
