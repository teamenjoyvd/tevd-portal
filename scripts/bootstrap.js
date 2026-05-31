#!/usr/bin/env node
"use strict";

const readline = require("readline");
const fs = require("fs");
const path = require("path");

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
  if (fs.existsSync(dest)) {
    return "skipped";
  }
  try {
    const srcFull = path.join(ROOT, src);
    if (!fs.existsSync(srcFull)) {
      return "source-missing";
    }
    ensureDir(path.dirname(path.join(ROOT, dest)));
    fs.copyFileSync(srcFull, path.join(ROOT, dest));
    return "created";
  } catch (err) {
    return `error: ${err.message}`;
  }
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
      const config = {
        name: projectName,
        repo: repoCoord,
        productionUrl: prodUrl || "",
        version: "2.0.0",
      };
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
        const separator = existing.endsWith("\n") || existing === "" ? "" : "\n";
        fs.writeFileSync(
          gitignorePath,
          existing + separator + appendContent,
          "utf8"
        );
        console.log("  ✅ .gitignore — appended template entries");
        summary.created.push(".gitignore (appended)");
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
      const hookContent = "#!/bin/sh\nnode scripts/validate-rules.js\n";
      try {
        fs.writeFileSync(hookPath, hookContent, { encoding: "utf8", mode: 0o755 });
        console.log("  ✅ Pre-commit hook installed.");
        summary.created.push(".git/hooks/pre-commit");
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
