#!/usr/bin/env node
"use strict";

/**
 * Local gate: the checks a draft PR gets on this machine instead of on GitHub.
 *
 * GitHub CI skips draft PRs (ci.yml, attribution.yml, migrations-check.yml) and
 * runs once when the PR is marked ready, so the draft loop has to be checked
 * here. Order and rules: docs/working-procedure.md "Landing".
 *
 * Usage:
 *   node scripts/local-gate.js pre-push   fast checks, run by .githooks/pre-push
 *   node scripts/local-gate.js ci         every required CI check, before marking
 *                                         a PR ready (npm run verify:ci)
 *
 * Exit 1 when a check fails. A check that could not run here (no Docker for the
 * migration replay) prints NOT RUN and does not fail the gate: CI's required
 * "Replay migrations from scratch" job still runs it once the PR is ready.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = "origin/main";
// Same pin as the three workflows (#781).
const SUPABASE = ["-y", "supabase@2.122.1"];

// ci.yml "build" job env, verbatim. @next/env never overrides a var already in
// process.env, so these also keep a local build off whatever .env.local holds
// (on some machines, PROD credentials).
const CI_BUILD_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
  NEXT_PUBLIC_APP_URL: "https://placeholder.tevd.app",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder",
  CLERK_SECRET_KEY: "placeholder",
  ICAL_TOKEN_SECRET: "placeholder",
};

const PASS = "PASS";
const FAIL = "FAIL";
const NOT_RUN = "NOT RUN";

/** Runs a command from the repo root. Never throws: a spawn error is a failed run. */
function run(cmd, args, { quiet = false, env = {} } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: quiet ? "pipe" : "inherit",
    encoding: "utf8",
    // npm and npx are .cmd shims on Windows, which spawnSync only runs via a shell.
    shell: process.platform === "win32" && cmd !== process.execPath,
    env: { ...process.env, ...env },
  });
  if (r.error) return { ok: false, stdout: "", error: r.error.message };
  return { ok: r.status === 0, stdout: r.stdout || "" };
}

function result(status, detail = "") {
  return { status, detail };
}

function fromRun(r) {
  return r.ok ? result(PASS) : result(FAIL, r.error || "");
}

function npmScript(name, env) {
  return () => fromRun(run("npm", ["run", "-s", name], { env }));
}

function checkNode() {
  let want;
  try {
    want = fs.readFileSync(path.join(ROOT, ".nvmrc"), "utf8").trim();
  } catch (e) {
    return result(FAIL, `cannot read .nvmrc: ${e.message}`);
  }
  const have = process.versions.node;
  if (have.split(".")[0] === want.split(".")[0]) return result(PASS, `v${have}`);
  return result(
    FAIL,
    `running Node v${have}, but .nvmrc and CI use ${want}. Switch first: ` +
      `docs/DEV_WORKFLOW.md "macOS setup" step 1.`,
  );
}

function checkAttribution() {
  return fromRun(run(process.execPath, ["scripts/check-ai-attribution.js", `${BASE}..HEAD`]));
}

/** true / false, or null when git cannot tell (no origin/main, not a repo). */
function supabaseChanged() {
  const mb = run("git", ["merge-base", BASE, "HEAD"], { quiet: true });
  if (!mb.ok) return null;
  // Committed and uncommitted changes since the branch point, like CI's
  // `origin/main...HEAD`, plus new files not yet added.
  const diff = run("git", ["diff", "--name-only", mb.stdout.trim(), "--", "supabase/"], { quiet: true });
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard", "--", "supabase/"], {
    quiet: true,
  });
  if (!diff.ok || !untracked.ok) return null;
  return (diff.stdout + untracked.stdout).trim() !== "";
}

function replayMigrations() {
  const changed = supabaseChanged();
  if (changed === null) return result(NOT_RUN, `git cannot diff against ${BASE} (run git fetch origin)`);
  if (!changed) return result(PASS, "no supabase/ changes; CI passes this check the same way");
  if (!run("docker", ["info"], { quiet: true }).ok) {
    return result(NOT_RUN, "supabase/ changed but Docker is not running; CI replays it when the PR is ready");
  }

  // --local everywhere: never the linked (hosted DEV) project.
  const wasRunning = run("npx", [...SUPABASE, "status"], { quiet: true }).ok;
  try {
    // A stack that cannot start is this machine's setup, not the migrations.
    if (!wasRunning && !run("npx", [...SUPABASE, "start"]).ok) {
      return result(NOT_RUN, "local Supabase stack did not start (output above); CI replays it when the PR is ready");
    }
    if (!run("npx", [...SUPABASE, "db", "reset", "--local"]).ok) return result(FAIL, "db reset --local failed");
    if (!run("npx", [...SUPABASE, "db", "lint", "--local", "--level", "error"]).ok) {
      return result(FAIL, "db lint --local --level error failed");
    }
    return result(PASS);
  } finally {
    // Leave the machine as we found it: stop only a stack this run started.
    if (!wasRunning) run("npx", [...SUPABASE, "stop"], { quiet: true });
  }
}

const FAST = [
  ["Node version", checkNode],
  ["Colour tokens", npmScript("check:colors")],
  ["Lint", npmScript("lint")],
  ["Type check", npmScript("check-types")],
  ["Unit tests", npmScript("test")],
  ["No AI attribution", checkAttribution],
];

const MODES = {
  "pre-push": FAST,
  ci: [
    ...FAST,
    ["Build (CI placeholder env)", npmScript("build", CI_BUILD_ENV)],
    ["Replay migrations", replayMigrations],
  ],
};

function main() {
  const mode = process.argv[2];
  const steps = MODES[mode];
  if (!steps) {
    console.error(`usage: node scripts/local-gate.js <${Object.keys(MODES).join("|")}>`);
    process.exit(2);
  }

  if (mode === "ci") {
    const hooks = run("git", ["config", "--get", "core.hooksPath"], { quiet: true });
    if (hooks.stdout.trim() !== ".githooks") {
      console.warn("local-gate: the pre-push hook is not enabled. Run once: git config core.hooksPath .githooks");
    }
  }

  const results = [];
  for (const [name, fn] of steps) {
    console.log(`\nlocal-gate ▸ ${name}`);
    const started = Date.now();
    const r = fn();
    results.push({ name, ...r, secs: Math.round((Date.now() - started) / 1000) });
    if (r.status === FAIL) break; // fail fast: later checks would only add noise
  }

  console.log(`\nlocal-gate (${mode}) summary:`);
  for (const r of results) {
    console.log(`  ${r.status.padEnd(7)} ${r.name} (${r.secs}s)${r.detail ? ` — ${r.detail}` : ""}`);
  }
  const notReached = steps.length - results.length;
  if (notReached > 0) console.log(`  ${notReached} later check(s) not reached.`);

  if (results.some((r) => r.status === FAIL)) {
    if (mode === "pre-push") console.log("Push blocked. Fix the failure, or bypass once with git push --no-verify.");
    process.exit(1);
  }
  const notRun = results.filter((r) => r.status === NOT_RUN).length;
  if (notRun > 0) console.log(`${notRun} check(s) NOT RUN here: CI must run them before this is green.`);
}

main();
