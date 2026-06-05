#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function gitExec(cmd) {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
    }).trim();
  } catch {
    return null;
  }
}


function getCurrentBranch() {
  // Try git command first
  const branch = gitExec("git rev-parse --abbrev-ref HEAD");
  if (branch) return branch;

  // Fallback: read .git/HEAD directly
  try {
    const headContent = fs
      .readFileSync(path.join(ROOT, ".git", "HEAD"), "utf8")
      .trim();
    const match = headContent.match(/^ref: refs\/heads\/(.+)$/);
    if (match) return match[1];
    return headContent.slice(0, 8) + "… (detached)";
  } catch {
    return "unknown";
  }
}

function getModifiedFiles() {
  const output = gitExec("git status --porcelain");
  if (!output) return [];
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function extractTodosFromFiles(modifiedLines) {
  const todos = [];
  for (const line of modifiedLines) {
    // status is first 2 chars, then space, then filename
    const filePath = line.slice(3).trim();
    // Handle renamed files (old -> new)
    const actual = filePath.includes(" -> ")
      ? filePath.split(" -> ")[1]
      : filePath;
    const fullPath = path.join(ROOT, actual);
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      const fileLines = content.split("\n");
      for (let i = 0; i < fileLines.length; i++) {
        const match = fileLines[i].match(/\/\/\s*TODO[:\s](.+)/i);
        if (match) {
          todos.push(`- ${actual}:${i + 1} — ${match[1].trim()}`);
        }
      }
    } catch {
      // file deleted or unreadable
    }
  }
  return todos;
}

function getLastDecisions(content, count) {
  if (!content) return null;

  // Split by headings that look like decision entries (## or ### headings)
  const entries = content.split(/\n(?=##\s)/);
  if (entries.length <= 1) {
    // Try splitting by horizontal rules or numbered patterns
    const altEntries = content.split(/\n(?=---|\*\*\*|___|\d+\.\s)/);
    if (altEntries.length > 1) {
      return altEntries.slice(-count).join("\n").trim();
    }
    return content.trim();
  }
  return entries.slice(-count).join("\n").trim();
}

function main() {
  try {
    console.log("📋 Compiling handoff context…\n");

    // ── Gather data ──
    const branch = getCurrentBranch();
    const modifiedFiles = getModifiedFiles();
    const todos = extractTodosFromFiles(modifiedFiles);

    // Config
    const configPath = path.join(ROOT, "agentic.config.json");
    const configRaw = safeRead(configPath);
    let projectName = "agentic";
    let configSection = "Not configured";
    if (configRaw) {
      try {
        const cfg = JSON.parse(configRaw);
        if (cfg.name) projectName = cfg.name;
        configSection = "```json\n" + configRaw.trim() + "\n```";
      } catch {
        configSection = "Found but could not parse agentic.config.json";
      }
    }

    // Gotchas
    const gotchasPath = path.join(ROOT, "docs", "ai", "GOTCHAS.md");
    const gotchas = safeRead(gotchasPath) || "None";

    // Decisions
    const decisionsPath = path.join(ROOT, "docs", "ai", "DECISIONS.md");
    const decisionsRaw = safeRead(decisionsPath);
    const decisions = decisionsRaw
      ? getLastDecisions(decisionsRaw, 3)
      : "None";

    // ── Build output ──
    const now = new Date().toISOString();
    const modifiedList =
      modifiedFiles.length > 0
        ? modifiedFiles.map((l) => `  - ${l}`).join("\n")
        : "  (none)";
    const todoList =
      todos.length > 0 ? todos.join("\n") : "- (no TODOs in modified files)";

    const output = `# Handoff Context — ${projectName}
Generated: ${now}

## Current State
- Branch: \`${branch}\`
- Modified Files: ${modifiedFiles.length}
${modifiedList}
- Open TODOs:
${todoList}

## Project Config
${configSection}

## Active Gotchas
${gotchas}

## Recent Decisions
${decisions}

## Instructions for Next Session
1. Run \`SSU\` to initialize
2. Check the PR session state for in-flight work
3. Continue from the current branch
`;

    // ── Write file ──
    const outPath = path.join(ROOT, ".handoff.md");
    fs.writeFileSync(outPath, output, "utf8");
    console.log(`✅ Handoff written to: ${outPath}`);

    // ── Clipboard ──
    try {
      const pbcopy = process.platform === "darwin" ? "pbcopy" : process.platform === "win32" ? "clip.exe" : "xclip -selection clipboard";
      execSync(pbcopy, {
        input: output,
        windowsHide: true,
        timeout: 5000,
      });
      console.log(`📋 Copied to clipboard via ${pbcopy.split(" ")[0]}`);
    } catch {
      console.log(
        "⚠️  Could not copy to clipboard. Manually copy from .handoff.md"
      );
    }

    console.log("\nDone.");
    process.exit(0);
  } catch (err) {
    console.error(`💥 Handoff script failed: ${err.message}`);
    process.exit(1);
  }
}

main();
