#!/usr/bin/env node
"use strict";

/**
 * No-AI-attribution gate (AGENTS.md Hard Constraints, .github/CONTRIBUTING.md).
 *
 * Fails when a commit message, PR title or PR body credits an AI tool. Coding
 * assistants append these lines by default, so the rule only holds if a
 * machine refuses them: a written rule alone was ignored in hundreds of
 * commits before this gate existed.
 *
 * What counts as a violation (case-insensitive):
 *   - a `Co-Authored-By:` trailer naming an AI tool or vendor
 *   - a "Generated with/by <AI tool>" line
 *   - an AI tool's noreply address or product link
 *
 * Mentioning a tool in prose ("update CLAUDE.md", "fix the Copilot config") is
 * fine: only the attribution shapes above fail.
 *
 * Only the range it is given is checked, so history from before the rule is
 * never re-litigated.
 *
 * Usage:
 *   node scripts/check-ai-attribution.js [<base>..<head>]
 *   PR_TITLE / PR_BODY env vars, when set, are checked too (CI passes them
 *   through env, never interpolated into the shell).
 */

const { execFileSync } = require("child_process");

const AI_NAMES =
  "claude|anthropic|openai|chatgpt|gpt-?\\d|copilot|gemini|cursor|codex|devin|aider|windsurf|cody";

const RULES = [
  {
    name: "Co-Authored-By trailer naming an AI",
    re: new RegExp(`^\\s*co-authored-by:.*\\b(${AI_NAMES})\\b`, "im"),
  },
  {
    name: '"Generated with/by" AI line',
    re: new RegExp(`generated (with|by)\\b[^\\n]*\\b(${AI_NAMES}|ai)\\b`, "i"),
  },
  {
    name: "AI tool noreply address or product link",
    re: /noreply@anthropic\.com|noreply@openai\.com|claude\.com\/claude-code|copilot@github\.com/i,
  },
];

/** Returns the names of the rules `text` breaks, in RULES order. */
function findAttribution(text) {
  if (text == null || text === "") return [];
  return RULES.filter((r) => r.re.test(text)).map((r) => r.name);
}

/** Splits `git log` output into { sha, message } records. */
function commitsInRange(range) {
  const out = execFileSync("git", ["log", "--format=%H%x1f%B%x1e", range], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\x1e")
    .map((rec) => rec.replace(/^\n+/, ""))
    .filter((rec) => rec !== "")
    .map((rec) => {
      const [sha, message = ""] = rec.split("\x1f");
      return { sha, message };
    });
}

function main() {
  const range = process.argv[2];
  const failures = [];

  if (range !== undefined) {
    let commits;
    try {
      commits = commitsInRange(range);
    } catch (e) {
      // A bad range (shallow clone, typo) must not pass as "no violations".
      console.error(`check:attribution: cannot read commits in ${range}: ${e.message.split("\n")[0]}`);
      process.exit(2);
    }
    for (const c of commits) {
      for (const rule of findAttribution(c.message)) failures.push(`commit ${c.sha.slice(0, 9)}: ${rule}`);
    }
    console.log(`check:attribution: ${commits.length} commit(s) in ${range} checked.`);
  }

  for (const [label, value] of [["PR title", process.env.PR_TITLE], ["PR body", process.env.PR_BODY]]) {
    if (value === undefined) continue;
    for (const rule of findAttribution(value)) failures.push(`${label}: ${rule}`);
    console.log(`check:attribution: ${label} checked.`);
  }

  if (failures.length > 0) {
    console.error("check:attribution: AI attribution found (see .github/CONTRIBUTING.md):");
    for (const f of failures) console.error(`  ${f}`);
    console.error("Fix: reword the commit (git commit --amend / rebase) or edit the PR text, then re-run.");
    process.exit(1);
  }
  console.log("check:attribution: clean.");
}

if (require.main === module) main();

module.exports = { findAttribution, RULES };
