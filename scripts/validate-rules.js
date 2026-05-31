#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(msg) {
  passCount++;
  console.log(`  \u2705 ${msg}`);
}
function warn(msg) {
  warnCount++;
  console.log(`  \u26A0\uFE0F  ${msg}`);
}
function fail(msg) {
  failCount++;
  console.log(`  \u274C ${msg}`);
}

// ── Prerequisite helpers ──────────────────────────────────────────────
function cmdExists(cmd) {
  try {
    const command = process.platform === "win32" ? "where" : "which";
    execSync(`${command} ${cmd}`, { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function gitAvailable() {
  return cmdExists("git");
}

function ghAvailable() {
  return cmdExists("gh");
}

// ── File helpers ──────────────────────────────────────────────────────
function walkFiles(dir, exts, ignore) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (ignore.includes(entry.name)) continue;
      if (entry.isDirectory()) {
        results.push(...walkFiles(full, exts, ignore));
      } else if (exts.some((e) => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  } catch {
    // directory unreadable — skip silently
  }
  return results;
}

// ── Check 1: Middleware misuse ────────────────────────────────────────
function checkMiddleware() {
  console.log("\n── Middleware Misuse ──");
  const mwPath = path.join(ROOT, "middleware.ts");
  if (!fs.existsSync(mwPath)) {
    pass("middleware.ts not found — nothing to check.");
    return;
  }

  try {
    const content = fs.readFileSync(mwPath, "utf8");
    const forbidden = [
      { pattern: /NextResponse\.rewrite/g, label: "NextResponse.rewrite" },
      { pattern: /NextResponse\.redirect/g, label: "NextResponse.redirect" },
      {
        pattern: /\.headers\.set\s*\(/g,
        label: "manual header manipulation (.headers.set)",
      },
      {
        pattern: /\.headers\.append\s*\(/g,
        label: "manual header manipulation (.headers.append)",
      },
    ];

    let clean = true;
    for (const { pattern, label } of forbidden) {
      if (pattern.test(content)) {
        fail(`middleware.ts contains ${label}. Only clerkMiddleware is allowed.`);
        clean = false;
      }
    }
    if (clean) {
      pass("middleware.ts contains only allowed Clerk patterns.");
    }
  } catch (err) {
    warn(`Could not read middleware.ts: ${err.message}`);
  }
}

// ── Check 2: Secret leak scan ────────────────────────────────────────
function checkSecretLeaks() {
  console.log("\n── Secret Leak Scan ──");
  const appDir = path.join(ROOT, "app");
  if (!fs.existsSync(appDir)) {
    pass("No app/ directory found — nothing to scan.");
    return;
  }

  const files = walkFiles(appDir, [".ts", ".tsx", ".js"], [
    "node_modules",
    ".next",
    ".git",
  ]);

  let found = false;
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf8");
      if (
        content.includes("'use client'") ||
        content.includes('"use client"')
      ) {
        if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
          const rel = path.relative(ROOT, file);
          fail(
            `SUPABASE_SERVICE_ROLE_KEY referenced in client component: ${rel}`
          );
          found = true;
        }
      }
    } catch {
      // unreadable file — skip
    }
  }
  if (!found) {
    pass("No SUPABASE_SERVICE_ROLE_KEY leaks found in client components.");
  }
}

// ── Check 3: Migration rollback check ────────────────────────────────
function checkMigrationRollbacks() {
  console.log("\n── Migration Rollback Comments ──");
  const migrationsDir = path.join(ROOT, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    pass("No supabase/migrations/ directory found — nothing to check.");
    return;
  }

  let allGood = true;
  try {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"));

    if (files.length === 0) {
      pass("No .sql migration files found.");
      return;
    }

    for (const file of files) {
      try {
        const content = fs.readFileSync(
          path.join(migrationsDir, file),
          "utf8"
        );
        if (!/-- ROLLBACK:/i.test(content)) {
          warn(`Migration ${file} is missing a -- ROLLBACK: comment.`);
          allGood = false;
        }
      } catch {
        warn(`Could not read migration file: ${file}`);
        allGood = false;
      }
    }
  } catch {
    warn("Could not read supabase/migrations/ directory.");
    allGood = false;
  }

  if (allGood) {
    pass("All migration files contain ROLLBACK comments.");
  }
}

// ── Check 4: Merged-branch alarm ─────────────────────────────────────
function checkMergedBranch(hasGit) {
  console.log("\n── Merged Branch Alarm ──");
  if (!hasGit) {
    warn("git not available — skipping merged-branch check.");
    return;
  }

  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
    }).trim();

    if (branch === "main" || branch === "master") {
      pass(`On ${branch} — no merge check needed.`);
      return;
    }

    // Check if current branch HEAD is an ancestor of main
    try {

      // Try main first, then master
      let mainBranch = "main";
      try {
        execSync("git rev-parse --verify main", {
          cwd: ROOT,
          stdio: "ignore",
          windowsHide: true,
        });
      } catch {
        mainBranch = "master";
        try {
          execSync("git rev-parse --verify master", {
            cwd: ROOT,
            stdio: "ignore",
            windowsHide: true,
          });
        } catch {
          pass("No main/master branch found — skipping merge check.");
          return;
        }
      }

      try {
        execSync(`git merge-base --is-ancestor HEAD ${mainBranch}`, {
          cwd: ROOT,
          stdio: "ignore",
          windowsHide: true,
        });
        // Exit code 0 means HEAD IS an ancestor of main → merged
        warn(
          `Current branch "${branch}" appears to be merged into ${mainBranch}. Create a new branch.`
        );
      } catch {
        // Non-zero exit = not an ancestor = not merged
        pass(`Branch "${branch}" has not been merged into ${mainBranch}.`);
      }
    } catch (err) {
      warn(`Could not determine merge status: ${err.message}`);
    }
  } catch (err) {
    warn(`Could not determine current branch: ${err.message}`);
  }
}

// ── Check 5: Branch naming ───────────────────────────────────────────
function checkBranchNaming(hasGit) {
  console.log("\n── Branch Naming Convention ──");
  if (!hasGit) {
    warn("git not available — skipping branch naming check.");
    return;
  }

  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
    }).trim();

    if (branch === "main" || branch === "master") {
      pass(`On ${branch} — naming convention does not apply.`);
      return;
    }

    if (branch.startsWith("dev/")) {
      pass(`Branch "${branch}" follows dev/ naming convention.`);
    } else {
      warn(
        `Branch "${branch}" does not follow the dev/ prefix naming convention.`
      );
    }
  } catch (err) {
    warn(`Could not determine current branch: ${err.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────
function main() {
  try {
    console.log("🔍 Agentic Rule Validator\n");

    const hasGit = gitAvailable();
    const hasGh = ghAvailable();

    if (!hasGit) {
      console.log("  ℹ️  git not found — file-based checks only.");
    }
    if (!hasGh) {
      console.log("  ℹ️  gh (GitHub CLI) not found — skipping GitHub checks.");
    }

    checkMiddleware();
    checkSecretLeaks();
    checkMigrationRollbacks();
    checkMergedBranch(hasGit);
    checkBranchNaming(hasGit);

    // ── Summary ──
    console.log("\n── Summary ──");
    console.log(
      `  Passed: ${passCount}  |  Warnings: ${warnCount}  |  Failures: ${failCount}`
    );

    if (failCount > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`\n💥 Validator crashed: ${err.message}`);
    process.exit(2);
  }
}

main();
