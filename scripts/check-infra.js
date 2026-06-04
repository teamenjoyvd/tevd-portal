#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

// Tracked directories and root-level files
const TRACKED_DIRS = [".cursor/rules", "scripts", "docs/ai"];
const TRACKED_FILES = ["CLAUDE.md"];

// Helper to print help/usage
function printHelp() {
  console.log(`
🌌 Agentic Infrastructure Self-Check

Usage:
  npm run agentic:check [options]

Options:
  -d, --diff     Show inline colored diffs for MODIFIED files.
  -h, --help     Print this help message.

Tracked Namespaces:
  Directories:
${TRACKED_DIRS.map(d => `    - ${d}/`).join("\n")}
  Files:
${TRACKED_FILES.map(f => `    - ${f}`).join("\n")}

Exit Codes:
  0: Clean (all tracked files match baseline or are ignored)
  1: Drift detected (at least one file is modified, missing, or untracked)
  2: Script error (missing/invalid config, unknown schema version, etc.)
`);
}

// Helper to compute MD5 hash of a file with normalized line endings
function computeHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath);
    // Normalize line endings to LF to ensure cross-platform hash stability
    const normalized = content.toString("utf8").replace(/\r\n/g, "\n");
    return crypto.createHash("md5").update(normalized).digest("hex");
  } catch (err) {
    return null;
  }
}

// Recursively find all files in a directory
function getFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  let files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getFilesRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore read errors
  }
  return files;
}

// Scan all currently existing tracked files on disk
function scanDiskTrackedFiles() {
  const files = [];
  for (const dir of TRACKED_DIRS) {
    const dirPath = path.join(ROOT, dir);
    const dirFiles = getFilesRecursive(dirPath);
    for (const f of dirFiles) {
      files.push(path.relative(ROOT, f).replace(/\\/g, "/"));
    }
  }
  for (const f of TRACKED_FILES) {
    const filePath = path.join(ROOT, f);
    if (fs.existsSync(filePath)) {
      files.push(f);
    }
  }
  return files;
}

// Parse .infraignore from project root
function loadInfraIgnore() {
  const ignorePath = path.join(ROOT, ".infraignore");
  if (!fs.existsSync(ignorePath)) return [];
  try {
    return fs.readFileSync(ignorePath, "utf8")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"));
  } catch (err) {
    return [];
  }
}

// Match file against ignore patterns
function isIgnored(file, ignoreList) {
  const normalized = file.replace(/\\/g, "/");
  return ignoreList.some(pattern => {
    const normalizedPattern = pattern.replace(/\\/g, "/");
    if (normalized === normalizedPattern) return true;
    if (normalized.startsWith(normalizedPattern + "/")) return true;
    return false;
  });
}

// Main execution function
function main() {
  const args = process.argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const showDiff = args.includes("-d") || args.includes("--diff");

  console.log("\n🌌 Agentic Infrastructure Self-Check\n");

  const configPath = path.join(ROOT, "agentic.config.json");
  if (!fs.existsSync(configPath)) {
    console.error("❌ Error: agentic.config.json is missing in project root.");
    console.error("👉 Run 'npm run agentic:bootstrap' to initialize the project.\n");
    process.exit(2);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error(`❌ Error: Failed to parse agentic.config.json: ${err.message}`);
    process.exit(2);
  }

  // Validate $schemaVersion
  const schemaVersion = config.$schemaVersion;
  if (schemaVersion === undefined) {
    console.error("❌ Error: Missing '$schemaVersion' field in agentic.config.json.");
    process.exit(2);
  }

  if (schemaVersion !== 1) {
    console.error(`❌ Error: Unknown config schema version: ${schemaVersion}. Supported version: 1.`);
    console.error("👉 Please verify your configuration or run upgrade.\n");
    process.exit(2);
  }

  if (!config.agentic || typeof config.agentic !== "object") {
    console.error("❌ Error: Missing or invalid 'agentic' block in agentic.config.json.");
    process.exit(2);
  }

  const projectBlock = config.project || {};
  const projectName = projectBlock.name || "Unknown Project";
  const agenticVersion = config.agentic.version || "Unknown";
  const agenticSha = config.agentic.sha || "Unknown";
  const baselineHashes = config.agentic.hashes || {};

  console.log(`📊 Project: ${projectName}`);
  console.log(`📌 Infra Version: ${agenticVersion} (sha: ${agenticSha})`);
  console.log("\n🔍 Scanning tracked files...");
  console.log("─────────────────────────────────────────────────");

  const diskFiles = scanDiskTrackedFiles();
  const ignoreList = loadInfraIgnore();

  // Combine baseline files and disk files to detect all states
  const allFilePaths = new Set([...Object.keys(baselineHashes), ...diskFiles]);
  const sortedFilePaths = Array.from(allFilePaths).sort();

  const results = [];
  let cleanCount = 0;
  let modifiedCount = 0;
  let ignoredCount = 0;
  let missingCount = 0;
  let untrackedCount = 0;

  for (const file of sortedFilePaths) {
    const fullPath = path.join(ROOT, file);
    const hasBaseline = baselineHashes.hasOwnProperty(file);
    const existsOnDisk = fs.existsSync(fullPath);

    if (isIgnored(file, ignoreList)) {
      results.push({ file, status: "IGNORED", label: "🛡️ [IGNORED]" });
      ignoredCount++;
    } else if (hasBaseline && !existsOnDisk) {
      results.push({ file, status: "MISSING", label: "❓ [MISSING]" });
      missingCount++;
    } else if (!hasBaseline && existsOnDisk) {
      results.push({ file, status: "UNTRACKED", label: "🆕 [UNTRACKED]" });
      untrackedCount++;
    } else {
      const diskHash = computeHash(fullPath);
      const baseHash = baselineHashes[file];
      if (diskHash === baseHash) {
        results.push({ file, status: "CLEAN", label: "✅ [CLEAN]" });
        cleanCount++;
      } else {
        results.push({ file, status: "MODIFIED", label: "⚠️  [MODIFIED]" });
        modifiedCount++;
      }
    }
  }

  // Print results table
  for (const res of results) {
    console.log(`${res.label.padEnd(15)} ${res.file}`);
  }
  console.log("─────────────────────────────────────────────────");

  console.log(`📋 Summary:
   Clean: ${cleanCount}  |  Modified: ${modifiedCount}  |  Ignored: ${ignoredCount}  |  Missing: ${missingCount}  |  Untracked: ${untrackedCount}
`);

  // Handle diffs if requested
  if (showDiff && modifiedCount > 0) {
    console.log("📝 Showing diffs for modified files:\n");
    for (const res of results) {
      if (res.status === "MODIFIED") {
        console.log(`\n--- Diff for ${res.file} ---`);
        try {
          // 1. Try git diff HEAD (uncommitted changes)
          let diffOutput = execSync(`git diff --color HEAD -- "${res.file}"`, {
            cwd: ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"]
          }).trim();

          // 2. If no uncommitted changes, find the last commit that modified agentic.config.json
          if (!diffOutput) {
            try {
              const lastConfigCommit = execSync('git log -1 --format="%H" -- agentic.config.json', {
                cwd: ROOT,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"]
              }).trim();

              if (lastConfigCommit) {
                diffOutput = execSync(`git diff --color ${lastConfigCommit} -- "${res.file}"`, {
                  cwd: ROOT,
                  encoding: "utf8",
                  stdio: ["ignore", "pipe", "ignore"]
                }).trim();
              }
            } catch (err) {
              // Ignore git commit log failure
            }
          }

          if (diffOutput) {
            console.log(diffOutput);
          } else {
            console.log("   [No git diff detected. File differs from config baseline but matched HEAD commit.]");
          }
        } catch (err) {
          console.error(`  ❌ Failed to run git diff: ${err.message}`);
        }
      }
    }
    console.log("");
  } else if (modifiedCount > 0 && !showDiff) {
    console.log("💡 Run with --diff to see exact changes on modified files.\n");
  }

  // Determine exit code
  const driftDetected = (modifiedCount > 0 || missingCount > 0 || untrackedCount > 0);
  if (driftDetected) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
