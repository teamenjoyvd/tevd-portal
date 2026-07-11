#!/usr/bin/env node

/**
 * Pre-push verification checklist
 * Run this before `git push` to catch issues early
 * Usage: npm run pre-push
 */

const { execSync } = require('child_process');
const path = require('path');

const checks = [
  {
    name: 'Environment variables',
    cmd: 'npm run check:env',
    critical: true,
  },
  {
    name: 'Linting',
    cmd: 'npm run lint',
    critical: true,
  },
  {
    name: 'Type checking',
    cmd: 'npm run check-types',
    critical: true,
  },
  {
    name: 'Unit tests',
    cmd: 'npm run test',
    critical: true,
  },
  {
    name: 'Build verification',
    cmd: 'npm run build',
    critical: true,
  },
  {
    name: 'Mobile responsiveness',
    cmd: 'npm run test:mobile',
    critical: false,
  },
  {
    name: 'Dependency audit',
    cmd: 'npm run audit:deps',
    critical: false,
  },
];

async function runChecks() {
  console.log('🚀 Pre-push verification checklist\n');
  console.log('═'.repeat(50));

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const check of checks) {
    const icon = check.critical ? '🔴' : '🟡';
    process.stdout.write(`${icon} ${check.name}... `);

    try {
      execSync(check.cmd, { stdio: ['pipe', 'pipe', 'pipe'] });
      console.log('✅');
      passed++;
      results.push({ ...check, success: true });
    } catch (err) {
      console.log(check.critical ? '❌ FAILED' : '⚠️  WARNING');
      failed++;
      results.push({ ...check, success: false });
    }
  }

  console.log('═'.repeat(50) + '\n');

  const criticalFails = results.filter(r => r.critical && !r.success);
  const warnings = results.filter(r => !r.critical && !r.success);

  if (criticalFails.length > 0) {
    console.error(`❌ ${criticalFails.length} critical check(s) failed:\n`);
    criticalFails.forEach(r => console.error(`   - ${r.name}`));
    console.error('\n⚠️  Fix issues above before pushing.\n');
    process.exit(1);
  }

  console.log(`✅ All critical checks passed (${passed}/${checks.length})`);

  if (warnings.length > 0) {
    console.warn(`\n⚠️  ${warnings.length} non-critical warning(s):`);
    warnings.forEach(w => console.warn(`   - ${w.name}`));
    console.warn('\nReview before pushing if concerned.\n');
  }

  console.log('Ready to push! 🚀\n');
}

runChecks().catch(err => {
  console.error('Pre-push check error:', err.message);
  process.exit(1);
});
