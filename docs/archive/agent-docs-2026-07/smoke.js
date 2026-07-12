#!/usr/bin/env node
"use strict";

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = path.resolve(__dirname, "..");

// ── Route definitions ────────────────────────────────────────────────
const ROUTES = [
  { path: "/", expect: 200, optional: false },
  { path: "/dashboard", expect: 302, optional: false },
  { path: "/api/health", expect: 200, optional: true },
];

// ── Helpers ──────────────────────────────────────────────────────────
function getBaseUrl() {
  // Check --url argument
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      return args[i + 1].replace(/\/+$/, "");
    }
    if (args[i].startsWith("--url=")) {
      return args[i].split("=")[1].replace(/\/+$/, "");
    }
  }

  // Fallback: read from agentic.config.json
  try {
    const configPath = path.join(ROOT, "agentic.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.productionUrl) {
      return config.productionUrl.replace(/\/+$/, "");
    }
  } catch {
    // config not available
  }

  return null;
}

function httpGet(urlString) {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    try {
      const parsed = new URL(urlString);
      const client = parsed.protocol === "https:" ? https : http;

      const req = client.get(
        urlString,
        {
          timeout: 10000,
          headers: { "User-Agent": "agentic-smoke/1.0" },
          // Don't follow redirects — we want to see the raw status
        },
        (res) => {
          // Consume the body to free resources
          res.resume();
          res.on("end", () => {
            safeResolve({ status: res.statusCode, error: null });
          });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        safeResolve({ status: null, error: "timeout" });
      });

      req.on("error", (err) => {
        safeResolve({ status: null, error: err.message });
      });
    } catch (err) {
      safeResolve({ status: null, error: err.message });
    }
  });
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  try {
    const baseUrl = getBaseUrl();

    if (!baseUrl) {
      console.log("🩺 Agentic Smoke Test\n");
      console.log("Usage: node scripts/smoke.js --url <base-url>");
      console.log(
        "   or: set productionUrl in agentic.config.json\n"
      );
      console.log("Example:");
      console.log(
        "  node scripts/smoke.js --url https://my-app.vercel.app"
      );
      process.exit(1);
      return;
    }

    console.log(`\n🩺 Smoke Test Results — ${baseUrl}\n`);

    let failures = 0;

    for (const route of ROUTES) {
      const fullUrl = baseUrl + route.path;
      const result = await httpGet(fullUrl);

      if (result.error) {
        if (route.optional) {
          console.log(
            `  \u26A0\uFE0F  ${route.path} → ERROR (skipped — ${result.error})`
          );
        } else {
          console.log(
            `  \u274C ${route.path} → ERROR: ${result.error} (expected ${route.expect})`
          );
          failures++;
        }
        continue;
      }

      const status = result.status;

      if (route.optional && status === 404) {
        console.log(
          `  \u26A0\uFE0F  ${route.path} → ${status} (skipped — route not found)`
        );
        continue;
      }

      if (status === route.expect) {
        console.log(
          `  \u2705 ${route.path} → ${status} (expected ${route.expect})`
        );
      } else {
        console.log(
          `  \u274C ${route.path} → ${status} (expected ${route.expect})`
        );
        failures++;
      }
    }

    console.log("");

    if (failures > 0) {
      console.log(`❌ ${failures} route(s) failed.\n`);
      process.exit(1);
    } else {
      console.log("✅ All routes passed.\n");
      process.exit(0);
    }
  } catch (err) {
    console.error(`💥 Smoke test crashed: ${err.message}`);
    process.exit(1);
  }
}

main();
