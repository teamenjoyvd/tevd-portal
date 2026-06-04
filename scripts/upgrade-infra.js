#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TEMP_CLONE_DIR = path.join(ROOT, ".agentic-temp-clone");

// Tracked directories and root-level files
const TRACKED_DIRS = [".cursor/rules", "scripts", "docs/ai"];
const TRACKED_FILES = ["CLAUDE.md"];

// Helper to print help/usage
function printHelp() {
  console.log(`
🌌 Agentic Infrastructure Upgrade Engine

Usage:
  npm run agentic:upgrade [options]

Options:
  --dry-run      Print the upgrade matrix and actions without writing to disk.
  --ci           Run in non-interactive mode. Aborts on conflicts or dirty working tree.
  -f, --force    Skip the Git dirty working tree check.
  --no-pin       Perform the upgrade sync, but do NOT update version/sha/hashes in config.
  --branch <name> Specify a feature branch to clone and upgrade from.
  -h, --help     Print this help message.

Exit Codes:
  0: Upgrade completed successfully.
  1: Upgrade aborted (dirty tree, conflict in CI mode, or user cancelled).
  2: Script error (network failure, git clone error, invalid config, etc.).
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

// Scan tracked files in a specific root directory
function scanDirectoryTrackedFiles(basePath) {
  const files = [];
  for (const dir of TRACKED_DIRS) {
    const dirPath = path.join(basePath, dir);
    const dirFiles = getFilesRecursive(dirPath);
    for (const f of dirFiles) {
      files.push(path.relative(basePath, f).replace(/\\/g, "/"));
    }
  }
  for (const f of TRACKED_FILES) {
    const filePath = path.join(basePath, f);
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
    let normalizedPattern = pattern.replace(/\\/g, "/");
    if (normalizedPattern.endsWith("/") && normalizedPattern.length > 1) {
      normalizedPattern = normalizedPattern.slice(0, -1);
    }
    if (normalized === normalizedPattern) return true;
    if (normalized.startsWith(normalizedPattern + "/")) return true;
    return false;
  });
}

// Helper to ask a question via terminal
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}

// Check if local working tree is dirty
function isGitDirty() {
  try {
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return status.length > 0;
  } catch (err) {
    // If not a git repo or git not found, treat as clean/ignored
    return false;
  }
}

// Helper to ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const isCi = args.includes("--ci");
  const force = args.includes("-f") || args.includes("--force");
  const noPin = args.includes("--no-pin");

  const branchIndex = args.indexOf("--branch");
  const branch = branchIndex !== -1 && branchIndex + 1 < args.length ? args[branchIndex + 1] : null;

  console.log("\n🚀 Agentic Infrastructure Upgrade Sync\n");

  // 1. Read local agentic.config.json
  const configPath = path.join(ROOT, "agentic.config.json");
  if (!fs.existsSync(configPath)) {
    console.error("❌ Error: agentic.config.json is missing in project root.");
    console.error("👉 Please run 'npm run agentic:bootstrap' first.\n");
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
    process.exit(2);
  }

  if (!config.agentic || typeof config.agentic !== "object") {
    console.error("❌ Error: Missing or invalid 'agentic' block in agentic.config.json.");
    process.exit(2);
  }

  // 2. Check git working tree status
  if (isGitDirty() && !force) {
    console.error("❌ Error: Git working tree is dirty. Please commit or stash changes before upgrading.");
    console.error("👉 Or use -f/--force to override this safeguard.\n");
    process.exit(1);
  }

  const upstreamRepo = config.agentic.repo || "https://github.com/teamenjoyvd/agentic";
  const localBaselineHashes = config.agentic.hashes || {};

  // 3. Clone central repo
  const branchLog = branch ? ` (branch: ${branch})` : "";
  console.log(`📦 Cloning upstream repository from ${upstreamRepo}${branchLog}...`);
  try {
    fs.rmSync(TEMP_CLONE_DIR, { recursive: true, force: true });
    const cloneArgs = ["clone"];
    if (branch) {
      cloneArgs.push("-b", branch);
    }
    cloneArgs.push("--depth", "1", "--quiet", upstreamRepo, TEMP_CLONE_DIR);
    execFileSync("git", cloneArgs, {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "pipe"]
    });
  } catch (err) {
    console.error(`❌ Error: Failed to clone central repository: ${err.message}`);
    if (err.stderr) {
      console.error(err.stderr.toString());
    }
    cleanup();
    process.exit(2);
  }

  try {
    // 4. Read central repo's version + HEAD SHA
    const centralConfigPath = path.join(TEMP_CLONE_DIR, "package.json");
    if (!fs.existsSync(centralConfigPath)) {
      throw new Error("Cloned repository is missing package.json.");
    }
    const centralPkg = JSON.parse(fs.readFileSync(centralConfigPath, "utf8"));
    const centralVersion = centralPkg.version || "Unknown";

    let centralSha = "Unknown";
    try {
      centralSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        cwd: TEMP_CLONE_DIR,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim();
    } catch (err) {
      // Ignore SHA read error
    }

    console.log(`📌 Central Version: ${centralVersion} (sha: ${centralSha})`);

    // 5. Load .infraignore
    const ignoreList = loadInfraIgnore();

    // Scan central tracked files
    const centralFiles = scanDirectoryTrackedFiles(TEMP_CLONE_DIR);
    
    // Combine central and local baselines to check all potential files
    const allFiles = new Set([...Object.keys(localBaselineHashes), ...centralFiles]);
    const sortedFiles = Array.from(allFiles).sort();

    const upgradeMatrix = [];
    const localConflicts = [];

    // Analyze files and prepare execution matrix
    for (const file of sortedFiles) {
      const centralFilePath = path.join(TEMP_CLONE_DIR, file);
      const localFilePath = path.join(ROOT, file);

      const existsInCentral = fs.existsSync(centralFilePath);
      const existsLocally = fs.existsSync(localFilePath);

      if (isIgnored(file, ignoreList)) {
        upgradeMatrix.push({ file, action: "SKIPPED", reason: "infraignore", label: "🛡️ [SKIPPED]" });
        continue;
      }

      if (!existsInCentral && existsLocally) {
        // Exists locally but not in central anymore (was deleted upstream)
        // Check if locally modified
        const localHash = computeHash(localFilePath);
        const baseHash = localBaselineHashes[file];
        const isLocallyModified = localHash !== baseHash;

        if (isLocallyModified) {
          localConflicts.push(file);
        }
        upgradeMatrix.push({ file, action: "DELETE", label: "🔥 [DELETE]" });
        continue;
      }

      if (existsInCentral && !existsLocally) {
        upgradeMatrix.push({ file, action: "ADD", label: "🆕 [ADD]" });
        continue;
      }

      // Exists in both
      const centralHash = computeHash(centralFilePath);
      const localHash = computeHash(localFilePath);
      const baseHash = localBaselineHashes[file];

      const isLocallyModified = localHash !== baseHash;
      const isUpstreamChanged = centralHash !== baseHash;

      if (isLocallyModified && isUpstreamChanged) {
        localConflicts.push(file);
      }

      if (centralHash === localHash) {
        upgradeMatrix.push({ file, action: "UNCHANGED", label: "✅ [UNCHANGED]" });
      } else {
        upgradeMatrix.push({ file, action: "UPDATE", label: "⚡ [UPDATE]" });
      }
    }

    // 6. Handle local conflicts
    if (localConflicts.length > 0) {
      console.log("\n⚠️  Warning: The following files have local modifications that would be overwritten:");
      for (const file of localConflicts) {
        console.log(`   - ${file}`);
      }

      if (isCi) {
        console.error("\n❌ Error: Aborting upgrade due to local conflicts in non-interactive CI mode.");
        console.error("👉 Commit changes, stash them, or add the paths to .infraignore.\n");
        cleanup();
        process.exit(1);
      }

      const answer = await askQuestion("\n🤔 Do you want to proceed and overwrite these local changes? (y/n): ");
      if (answer.toLowerCase() !== "y") {
        console.log("\n❌ Upgrade cancelled by operator.\n");
        cleanup();
        process.exit(1);
      }
    }

    // Print execution matrix
    console.log("\n📋 Upgrade Execution Matrix:");
    console.log("─────────────────────────────────────────────────");
    for (const item of upgradeMatrix) {
      if (item.action === "UNCHANGED") continue; // Hide unchanged to reduce clutter
      const reasonStr = item.reason ? ` (${item.reason})` : "";
      console.log(`${item.label.padEnd(15)} ${item.file}${reasonStr}`);
    }
    console.log("─────────────────────────────────────────────────");

    if (dryRun) {
      console.log("\n✨ Dry run complete. No modifications were written to disk.\n");
      cleanup();
      process.exit(0);
    }

    // Perform actual write operations
    console.log("✍️  Writing updates to disk...");
    const writtenFiles = [];
    const skippedFiles = [];

    for (const item of upgradeMatrix) {
      const localFilePath = path.join(ROOT, item.file);
      const centralFilePath = path.join(TEMP_CLONE_DIR, item.file);

      if (item.action === "SKIPPED") {
        skippedFiles.push(item.file);
        continue;
      }

      if (item.action === "DELETE") {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
          console.log(`   🔥 Deleted: ${item.file}`);
          writtenFiles.push({ file: item.file, action: "DELETED" });
        }
        continue;
      }

      if (item.action === "ADD" || item.action === "UPDATE") {
        ensureDir(path.dirname(localFilePath));
        fs.copyFileSync(centralFilePath, localFilePath);
        console.log(`   ⚡ Synced:  ${item.file}`);
        writtenFiles.push({ file: item.file, action: item.action === "ADD" ? "ADDED" : "UPDATED" });
      }
    }

    // 7. Update agentic.config.json
    if (!noPin) {
      console.log("⚙️  Updating agentic.config.json hashes and pin...");
      
      // Re-read config in case of safe edits
      const currentConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      currentConfig.agentic.version = centralVersion;
      currentConfig.agentic.sha = centralSha;
      
      // Recompute baseline hashes of all currently synced tracked files on disk
      const updatedBaselineHashes = {};
      const localTrackedFiles = scanDirectoryTrackedFiles(ROOT);
      
      for (const file of localTrackedFiles) {
        if (isIgnored(file, ignoreList)) continue;
        const hash = computeHash(path.join(ROOT, file));
        if (hash) {
          updatedBaselineHashes[file] = hash;
        }
      }
      currentConfig.agentic.hashes = updatedBaselineHashes;

      // Crash-safe write
      const configTmpPath = configPath + ".tmp";
      fs.writeFileSync(configTmpPath, JSON.stringify(currentConfig, null, 2) + "\n", "utf8");
      fs.renameSync(configTmpPath, configPath);
      console.log("   ✅ agentic.config.json updated.");
    } else {
      console.log("⏭️  --no-pin flag specified. Skipping agentic.config.json update.");
    }

    // 8. Append entry to .agentic-upgrade-log
    if (writtenFiles.length > 0 || skippedFiles.length > 0) {
      console.log("📝 Writing to .agentic-upgrade-log...");
      const logPath = path.join(ROOT, ".agentic-upgrade-log");
      
      let operator = "unknown";
      try {
        operator = execFileSync("git", ["config", "user.name"], {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }).trim();
      } catch (e) {
        // Fallback to env
        operator = process.env.USERNAME || process.env.USER || "unknown";
      }

      const timestamp = new Date().toISOString();
      const currentVersion = config.agentic.version || "Unknown";
      const currentSha = config.agentic.sha || "Unknown";

      let logEntry = `[${timestamp}] operator=${operator} from=v${currentVersion}(${currentSha}) to=v${centralVersion}(${centralSha})\n`;
      
      for (const f of writtenFiles) {
        logEntry += `  ${f.action.padEnd(8)} ${f.file}\n`;
      }
      for (const f of skippedFiles) {
        logEntry += `  SKIPPED  ${f} (infraignore)\n`;
      }
      logEntry += `  ---\n`;

      fs.appendFileSync(logPath, logEntry, "utf8");
      console.log("   ✅ .agentic-upgrade-log updated.");
    }

    console.log("\n🎉 Upgrade completed successfully!\n");
    cleanup();
    process.exit(0);

  } catch (err) {
    console.error(`\n💥 Upgrade failed: ${err.message}`);
    cleanup();
    process.exit(2);
  }
}

// 9. Clean up temp directory
function cleanup() {
  try {
    if (fs.existsSync(TEMP_CLONE_DIR)) {
      fs.rmSync(TEMP_CLONE_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    // Ignore cleanup error
  }
}

main();
