#!/usr/bin/env node

const { execSync } = require('child_process');

/**
 * Cleanup old branches and detect stale PRs
 * - Deletes local branches merged into main
 * - Lists branches not updated in 7+ days
 */

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function getBranches() {
  const output = runCmd('git branch -v');
  return output.split('\n').filter(line => line.trim()).map(line => {
    const parts = line.trim().split(/\s+/);
    return { name: parts[0] === '*' ? parts[1] : parts[0], sha: parts[1] };
  });
}

function getMergedBranches() {
  const output = runCmd('git branch --merged main');
  return output.split('\n').filter(line => line.trim() && !line.includes('main')).map(b => b.trim().replace(/^\*\s*/, ''));
}

console.log('🧹 Checking for stale branches...\n');

const merged = getMergedBranches();
if (merged.length > 0) {
  console.log('📌 Branches merged into main (safe to delete):');
  merged.forEach(b => console.log(`   - ${b}`));
  console.log('\nTo delete: git branch -D <branch-name>\n');
}

// List branches older than 7 days
const branches = getBranches();
const now = new Date();
const oldBranches = branches.filter(b => {
  try {
    const logDate = runCmd(`git log -1 --format=%ai ${b.name}`);
    if (!logDate) return false;
    const branchDate = new Date(logDate);
    const daysSinceUpdate = (now - branchDate) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7;
  } catch {
    return false;
  }
});

if (oldBranches.length > 0) {
  console.log('⚠️  Branches not updated in 7+ days:');
  oldBranches.forEach(b => console.log(`   - ${b.name}`));
  console.log('\nConsider deleting if work is complete.\n');
}

console.log('✅ Cleanup check complete.');
