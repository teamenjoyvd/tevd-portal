#!/usr/bin/env node
"use strict";

// Claude Code hook dispatcher (issue #572). Wired via .claude/settings.json.
// Reads the hook payload JSON from stdin. Exit codes:
//   0 = allow (optionally with a non-blocking warning on stderr for PostToolUse)
//   2 = block; stderr is fed back to Claude as the reason.
// Fail-open by design: any internal error exits 0 — CI stays authoritative.

const rules = require("../lib/rules");

const PROD_REF = "ynykjpnetfwqzdnsgkkg";

function posix(p) {
  return String(p || "").replace(/\\/g, "/");
}

function block(msg) {
  process.stderr.write(msg + "\n");
  process.exit(2);
}

/** Blocking checks for a single file write (Write/Edit or MCP file push). */
function fileWriteViolation(filePath, content) {
  const p = posix(filePath);
  if (rules.isMiddlewarePath(p)) {
    return "BLOCKED: middleware.ts is banned in this repo — auth lives in proxy.ts (CLAUDE.md hard constraint).";
  }
  if (rules.serviceRoleLeak(content) || (/(^|\/)components\//.test(p) && content.includes("SUPABASE_SERVICE_ROLE_KEY"))) {
    return "BLOCKED: SUPABASE_SERVICE_ROLE_KEY referenced in client-side code. Server DB access uses createServiceClient() in server-only modules.";
  }
  if (rules.serviceRoleInPublicEnv(content)) {
    return "BLOCKED: service-role key assigned to a NEXT_PUBLIC_ variable — that ships it to the browser.";
  }
  if (rules.isMigrationPath(p)) {
    const fileName = p.split("/").pop();
    if (!rules.isValidMigrationFilename(fileName)) {
      return `BLOCKED: migration filename "${fileName}" violates the YYYYMMDD_NNN_description.sql rule (docs/ai/GOTCHAS.md). List supabase/migrations/, find today's highest NNN, increment.`;
    }
  }
  return null;
}

/** Blocking checks for a Bash command. */
function bashViolation(command) {
  const cmd = String(command || "");
  // Never push to main (covers "push origin main", "push -f", "HEAD:main").
  if (/\bgit\s+push\b/.test(cmd) && /(\s|:)(main|master)\b/.test(cmd)) {
    return "BLOCKED: pushing to main is forbidden. Use a dev/[YYMM]-DEV-[GH#] branch and open a PR (CLAUDE.md hard constraint).";
  }
  // Branch naming at creation time.
  const m = cmd.match(/\bgit\s+(?:checkout\s+-b|switch\s+-c)\s+["']?([^\s"']+)/);
  if (m && !rules.isValidBranchName(m[1])) {
    return `BLOCKED: branch "${m[1]}" violates naming. Use dev/[YYMM]-DEV-[GH#] (e.g. dev/2607-DEV-572) or claude/*.`;
  }
  return null;
}

/** Non-blocking warnings (PostToolUse). Returns a message or null. */
function postWriteWarning(filePath, content) {
  const p = posix(filePath);
  if (rules.isMigrationPath(p) && content && !rules.hasRollbackComment(content)) {
    return "WARNING: migration lacks a -- ROLLBACK: comment (docs/ai/BUILD.md requires one).";
  }
  return null;
}

function bashWarning(command) {
  const cmd = String(command || "");
  if (cmd.includes(PROD_REF) || /\bsupabase\s+db\s+push\b/.test(cmd)) {
    return `WARNING: command may target a hosted Supabase project. Prod DDL (${PROD_REF}) goes exclusively through the gated migrate-prod workflow — never from a dev machine.`;
  }
  return null;
}

function main() {
  let input;
  try {
    input = JSON.parse(require("fs").readFileSync(0, "utf8"));
  } catch {
    return; // unparseable payload — fail open
  }
  const event = input.hook_event_name || "";
  const tool = input.tool_name || "";
  const ti = input.tool_input || {};

  if (event === "PreToolUse") {
    if (tool === "Write" || tool === "Edit") {
      const content = (ti.content || "") + (ti.new_string || "");
      const v = fileWriteViolation(ti.file_path, content);
      if (v) block(v);
    } else if (tool === "Bash") {
      const v = bashViolation(ti.command);
      if (v) block(v);
    } else if (
      tool === "mcp__github-tevd__push_files" ||
      tool === "mcp__github-tevd__create_or_update_file"
    ) {
      if (/^(main|master)$/.test(ti.branch || "")) {
        block("BLOCKED: writing files to main via GitHub MCP is forbidden. Push to a feature branch and open a PR.");
      }
      const files = Array.isArray(ti.files)
        ? ti.files.map((f) => ({ path: f.path, content: f.content || "" }))
        : [{ path: ti.path, content: ti.content || "" }];
      for (const f of files) {
        const v = fileWriteViolation(f.path, f.content);
        if (v) block(v);
      }
    } else if (tool === "mcp__github-tevd__create_branch") {
      const name = ti.branch || "";
      if (name && !rules.isValidBranchName(name)) {
        block(`BLOCKED: branch "${name}" violates naming. Use dev/[YYMM]-DEV-[GH#] or claude/*.`);
      }
    }
  }

  if (event === "PostToolUse") {
    let warning = null;
    if (tool === "Write" || tool === "Edit") {
      warning = postWriteWarning(ti.file_path, (ti.content || "") + (ti.new_string || ""));
    } else if (tool === "Bash") {
      warning = bashWarning(ti.command);
    }
    if (warning) {
      // additionalContext via stdout JSON keeps this non-blocking but visible.
      process.stdout.write(
        JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: warning } })
      );
    }
  }
}

try {
  main();
} catch {
  // fail open
}
process.exit(0);
