#!/usr/bin/env node

const requiredEnvVars = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_MAPBOX_TOKEN',
  'ICAL_TOKEN_SECRET',
  'NEXT_PUBLIC_APP_URL',
];

const missing = requiredEnvVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('❌ Missing environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('\nEnsure .env.local is present in the project root or worktree.');
  process.exit(1);
}

console.log('✅ All required environment variables are set.');
