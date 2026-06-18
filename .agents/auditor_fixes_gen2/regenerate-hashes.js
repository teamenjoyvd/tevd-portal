const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');

function getFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
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
  } catch {
    // Ignore read errors
  }
  return files;
}

function scanTrackedFiles() {
  const files = [];
  const dirs = [".cursor/rules", "scripts", "docs/ai"];
  for (const dir of dirs) {
    const dirPath = path.join(ROOT, dir);
    const dirFiles = getFilesRecursive(dirPath);
    for (const f of dirFiles) {
      files.push(path.relative(ROOT, f).replace(/\\/g, "/"));
    }
  }
  const rootFiles = ["CLAUDE.md"];
  for (const f of rootFiles) {
    const filePath = path.join(ROOT, f);
    if (fs.existsSync(filePath)) {
      files.push(f);
    }
  }
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

function computeHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  const normalized = content.toString("utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

function main() {
  const configPath = path.join(ROOT, 'agentic.config.json');
  if (!fs.existsSync(configPath)) {
    console.error("agentic.config.json not found!");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const oldHashes = config.agentic.hashes || {};
  const newHashes = {};

  const trackedFiles = scanTrackedFiles();
  console.log(`Scanning ${trackedFiles.length} tracked files...`);

  let changedCount = 0;
  for (const file of trackedFiles) {
    const fullPath = path.join(ROOT, file);
    const hash = computeHash(fullPath);
    if (hash) {
      newHashes[file] = hash;
      if (oldHashes[file] !== hash) {
        console.log(`Drift detected on: ${file}`);
        console.log(`  Old: ${oldHashes[file] || 'none'}`);
        console.log(`  New: ${hash}`);
        changedCount++;
      }
    }
  }

  // Also check if any old hashes were removed
  for (const file of Object.keys(oldHashes)) {
    if (!newHashes[file]) {
      console.log(`File removed from baseline: ${file}`);
      changedCount++;
    }
  }

  if (changedCount > 0) {
    console.log(`Updating agentic.config.json with ${changedCount} hash changes...`);
    config.agentic.hashes = newHashes;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    console.log("agentic.config.json updated successfully.");
  } else {
    console.log("No hash changes needed. agentic.config.json is clean.");
  }
}

main();
