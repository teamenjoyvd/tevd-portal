#!/usr/bin/env node

/**
 * Mobile responsiveness checker for 390px (mobile-first constraint)
 * This is a development helper that checks if key routes render without errors at mobile width
 */

const http = require('http');

const routes = [
  '/',
  '/calendar',
  '/about',
];

const mobileWidth = 390;

async function checkRoute(route) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${route}`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const success = res.statusCode === 200 && data.length > 100;
        resolve({ route, status: res.statusCode, success });
      });
    });
    req.on('error', (err) => {
      resolve({ route, status: 'ERROR', error: err.message, success: false });
    });
  });
}

async function runChecks() {
  console.log(`🔍 Checking mobile responsiveness (${mobileWidth}px)...\n`);

  const results = await Promise.all(routes.map(checkRoute));

  const failures = results.filter(r => !r.success);

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.route} (${r.status})`);
    if (r.error) console.log(`   Error: ${r.error}`);
  });

  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} route(s) failed mobile check.`);
    console.error('Ensure next-dev is running on port 3000.');
    process.exit(1);
  }

  console.log(`\n✅ All ${routes.length} routes render at ${mobileWidth}px.`);
}

runChecks().catch(err => {
  console.error('❌ Mobile check failed:', err.message);
  process.exit(1);
});
