#!/usr/bin/env node
"use strict";

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

// ── Helpers ──────────────────────────────────────────────────────────
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeCopyFile(src, dest) {
  const destFull = path.join(ROOT, dest);
  if (fs.existsSync(destFull)) {
    return "skipped";
  }
  try {
    const srcFull = path.join(ROOT, src);
    if (!fs.existsSync(srcFull)) {
      return "source-missing";
    }
    ensureDir(path.dirname(destFull));
    fs.copyFileSync(srcFull, destFull);
    return "created";
  } catch (err) {
    return `error: ${err.message}`;
  }
}

function computeHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  // Normalize line endings to avoid OS-specific differences (Windows \r\n vs Unix \n)
  const normalized = content.toString("utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch (err) {
    return "";
  }
}

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
  } catch (err) {
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

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const summary = { created: [], skipped: [], errors: [] };

  try {
    console.log("\n🚀 Agentic Bootstrap Wizard\n");

    // ── Step 1: Identity ──
    console.log("── Step 1: Identity ──");
    let projectName = "";
    while (!projectName) {
      projectName = await ask(rl, "  Project name (required): ");
      if (!projectName) console.log("  ⚠️  Project name is required.");
    }

    let repoCoord = "";
    while (!repoCoord) {
      repoCoord = await ask(rl, "  GitHub repo (user/repo, required): ");
      if (!repoCoord) console.log("  ⚠️  GitHub repo coordinate is required.");
    }

    const prodUrl = await ask(
      rl,
      "  Production URL (optional, press Enter to skip): "
    );

    // ── Step 2: Public Config ──
    console.log("\n── Step 2: Public Config ──");
    const configPath = path.join(ROOT, "agentic.config.json");
    const configTmpPath = configPath + ".tmp";

    let writeConfig = true;
    if (fs.existsSync(configPath)) {
      const answer = await ask(
        rl,
        "  ⚠️  agentic.config.json already exists. Overwrite? (y/n): "
      );
      writeConfig = answer.toLowerCase() === "y";
    }

    if (writeConfig) {
      const templatePath = path.join(ROOT, "templates", "agentic.config.json");
      if (!fs.existsSync(templatePath)) {
        throw new Error(`agentic.config.json template not found at: ${templatePath}`);
      }

      let configContent = fs.readFileSync(templatePath, "utf8");
      configContent = configContent
        .replace("__PROJECT_NAME__", projectName)
        .replace("__GITHUB_REPO__", repoCoord)
        .replace("__PRODUCTION_URL__", prodUrl || "");

      const config = JSON.parse(configContent);

      // Compute hashes of tracked files for the baseline
      console.log("  🔍 Computing initial tracked file baseline hashes...");
      const trackedFiles = scanTrackedFiles();
      config.agentic.hashes = {};
      for (const file of trackedFiles) {
        const hash = computeHash(path.join(ROOT, file));
        if (hash) {
          config.agentic.hashes[file] = hash;
        }
      }

      // Populate current git SHA if available
      const currentSha = getGitSha();
      if (currentSha) {
        config.agentic.sha = currentSha;
      }

      const configJson = JSON.stringify(config, null, 2) + "\n";

      // Crash-safe write: temp → rename
      fs.writeFileSync(configTmpPath, configJson, "utf8");
      fs.renameSync(configTmpPath, configPath);
      console.log("  ✅ agentic.config.json written.");
      summary.created.push("agentic.config.json");
    } else {
      console.log("  ⏭️  Skipped agentic.config.json.");
      summary.skipped.push("agentic.config.json");
    }

    // ── Step 3: Secrets ──
    console.log("\n── Step 3: Secrets Checklist ──");
    console.log("  Secrets Checklist (add to .env.local):");
    console.log("  [ ] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=");
    console.log("  [ ] CLERK_SECRET_KEY=");
    console.log("  [ ] NEXT_PUBLIC_SUPABASE_URL=");
    console.log("  [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY=");
    console.log("  [ ] SUPABASE_SERVICE_ROLE_KEY=");
    console.log("  (Do NOT type secrets here — add them directly to .env.local)");

    // ── Step 4: Scaffold ──
    console.log("\n── Step 4: Scaffold ──");
    const templateMappings = [
      { src: "templates/proxy.ts", dest: "lib/proxy.ts" },
      {
        src: "templates/lib/supabase/client.ts",
        dest: "lib/supabase/client.ts",
      },
      {
        src: "templates/lib/supabase/server.ts",
        dest: "lib/supabase/server.ts",
      },
      { src: "templates/app/globals.css", dest: "app/globals.css" },
    ];

    for (const { src, dest } of templateMappings) {
      const result = safeCopyFile(src, dest);
      switch (result) {
        case "created":
          console.log(`  ✅ ${dest} — created`);
          summary.created.push(dest);
          break;
        case "skipped":
          console.log(`  ⏭️  ${dest} — already exists, skipped`);
          summary.skipped.push(dest);
          break;
        case "source-missing":
          console.log(`  ⚠️  ${dest} — source template not found (${src})`);
          summary.skipped.push(dest);
          break;
        default:
          console.log(`  ❌ ${dest} — ${result}`);
          summary.errors.push(dest);
          break;
      }
    }

    // Append to .gitignore
    const gitignorePath = path.join(ROOT, ".gitignore");
    const appendPath = path.join(ROOT, "templates", ".gitignore.append");
    try {
      if (fs.existsSync(appendPath)) {
        const appendContent = fs.readFileSync(appendPath, "utf8");
        const existing = fs.existsSync(gitignorePath)
          ? fs.readFileSync(gitignorePath, "utf8")
          : "";
        if (existing.includes(appendContent.trim())) {
          console.log("  ⏱️  .gitignore — template entries already exist, skipped");
          summary.skipped.push(".gitignore (appended)");
        } else {
          const separator = existing.endsWith("\n") || existing === "" ? "" : "\n";
          fs.writeFileSync(
            gitignorePath,
            existing + separator + appendContent,
            "utf8"
          );
          console.log("  ✅ .gitignore — appended template entries");
          summary.created.push(".gitignore (appended)");
        }
      } else {
        console.log(
          "  ⚠️  templates/.gitignore.append not found — .gitignore unchanged"
        );
      }
    } catch (err) {
      console.log(`  ❌ .gitignore — error: ${err.message}`);
      summary.errors.push(".gitignore");
    }

    // ── Step 5: Pre-commit hook ──
    console.log("\n── Step 5: Pre-commit Hook ──");
    const hooksDir = path.join(ROOT, ".git", "hooks");
    if (fs.existsSync(hooksDir)) {
      const hookPath = path.join(hooksDir, "pre-commit");
      const validationCommand = "node scripts/validate-rules.js";
      const hookContent = `#!/bin/sh\n${validationCommand}\n`;
      try {
        let shouldWrite = true;
        if (fs.existsSync(hookPath)) {
          const existingHook = fs.readFileSync(hookPath, "utf8");
          if (existingHook.includes(validationCommand)) {
            shouldWrite = false;
            console.log("  ⏱️  Pre-commit hook already installed, skipped.");
            summary.skipped.push(".git/hooks/pre-commit");
          } else {
            const lines = existingHook.split(/\r?\n/);
            const hasLogic = lines.some(line => {
              const clean = line.trim();
              return clean && !clean.startsWith("#");
            });

            let updatedHook;
            if (hasLogic) {
              if (lines.length > 0 && lines[0].startsWith("#!")) {
                // Prepend right after the shebang line
                lines.splice(1, 0, validationCommand);
                updatedHook = lines.join("\n");
              } else {
                // No shebang, just prepend
                updatedHook = `${validationCommand}\n${existingHook}`;
              }
              fs.writeFileSync(hookPath, updatedHook, { encoding: "utf8", mode: 0o755 });
              console.log("  ✅ Pre-commit hook updated (prepended rule validator).");
              summary.created.push(".git/hooks/pre-commit (updated)");
              shouldWrite = false;
            } else {
              // The file has no logic (empty or comments only); safe to append or rewrite
              fs.appendFileSync(hookPath, `\n${validationCommand}\n`);
              console.log("  ✅ Pre-commit hook updated (appended rule validator).");
              summary.created.push(".git/hooks/pre-commit (updated)");
              shouldWrite = false;
            }
            try {
              fs.chmodSync(hookPath, 0o755);
            } catch (err) {
              // Ignore chmod error on systems where it is not supported
            }
          }
        }
        if (shouldWrite) {
          fs.writeFileSync(hookPath, hookContent, { encoding: "utf8", mode: 0o755 });
          console.log("  ✅ Pre-commit hook installed.");
          summary.created.push(".git/hooks/pre-commit");
        }
      } catch (err) {
        console.log(`  ❌ Could not write pre-commit hook: ${err.message}`);
        summary.errors.push(".git/hooks/pre-commit");
      }
    } else {
      console.log(
        "  ⚠️  .git/hooks/ not found — is this a git repository? Skipping hook."
      );
      summary.skipped.push(".git/hooks/pre-commit");
    }

    // ── Final Summary ──
    console.log("\n══════════════════════════════════════");
    console.log("  Bootstrap Summary");
    console.log("══════════════════════════════════════");
    if (summary.created.length > 0) {
      console.log(`  Created (${summary.created.length}):`);
      summary.created.forEach((f) => console.log(`    ✅ ${f}`));
    }
    if (summary.skipped.length > 0) {
      console.log(`  Skipped (${summary.skipped.length}):`);
      summary.skipped.forEach((f) => console.log(`    ⏭️  ${f}`));
    }
    if (summary.errors.length > 0) {
      console.log(`  Errors (${summary.errors.length}):`);
      summary.errors.forEach((f) => console.log(`    ❌ ${f}`));
    }

    console.log("\n  Vercel Environment Sync:");
    console.log(
      "  After deploying, add these env vars in Vercel Dashboard → Settings → Environment Variables:"
    );
    console.log("  - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    console.log("  - CLERK_SECRET_KEY");
    console.log("  - NEXT_PUBLIC_SUPABASE_URL");
    console.log("  - NEXT_PUBLIC_SUPABASE_ANON_KEY");
    console.log("  - SUPABASE_SERVICE_ROLE_KEY");
    console.log("");

    rl.close();
    process.exit(0);
  } catch (err) {
    rl.close();
    console.error(`\n💥 Bootstrap failed: ${err.message}`);
    process.exit(1);
  }
}

main();
