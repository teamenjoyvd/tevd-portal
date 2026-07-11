# Local Database Setup Plan

**Current state:** Migrations run on prod only. This is risky and limits safe iteration.

**Goal:** Set up a complete local development database so you can:
- Test migrations before prod
- Seed test data without affecting live data
- Reset state between features
- Collaborate with confidence

## Option 1: Supabase Local Development (Recommended)

### Why this is best for you:
- Zero production risk (migrations tested locally first)
- Instant database reset between features
- Same schema/auth as prod
- ~5 minute setup

### Setup steps:

#### 1. Install Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop install supabase

# Or via npm (any platform)
npm install -g @supabase/cli
```

#### 2. Start local Supabase stack
```bash
cd D:\react\teamenjoyvd\tevd-portal
supabase start
```

First run takes ~2 min (downloads Docker images). Subsequent runs are instant.

Output will show:
```
API URL: http://localhost:54321
Anon Key: eyJ...
Service Key: eyJ...
```

#### 3. Update `.env.local.dev` for local testing
Create a copy of `.env.local` called `.env.local.dev`:
```bash
# Copy prod .env.local
cp .env.local .env.local.dev

# Edit .env.local.dev with local values:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (from supabase start output)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (from supabase start output)
```

#### 4. Link your local Supabase to the project
```bash
supabase link --project-ref ynykjpnetfwqzdnsgkkg
# (project ref is in NEXT_PUBLIC_SUPABASE_URL from .env.local)
```

#### 5. Pull prod migrations into local
```bash
supabase db pull
# This downloads all migrations from prod into supabase/migrations/
```

#### 6. Apply migrations to local DB
```bash
supabase db push
# Applies all migrations to localhost:54321
```

#### 7. Seed test data (optional but recommended)
Create `supabase/seed.sql`:
```sql
-- Insert test users
INSERT INTO public.profiles (id, clerk_id, role) 
VALUES 
  ('test-user-1', 'user_test1', 'member'),
  ('test-admin-1', 'user_admin1', 'admin')
ON CONFLICT DO NOTHING;

-- Add test events, etc.
```

Then seed:
```bash
supabase db push --dry-run  # preview first
supabase db push           # apply
```

### Daily workflow:
```bash
# Start of day
supabase start

# Work on feature
npm run dev  # next-dev uses local DB via .env.local.dev

# Between features - reset local DB
supabase db reset

# Before pushing - test migration on local
supabase db push
npm run test
npm run pre-push
git push

# End of day
supabase stop
```

---

## Option 2: Docker Compose Setup (Alternative)

If you prefer not to use Supabase CLI:

1. Create `docker-compose.local.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tevd_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

2. Start: `docker-compose -f docker-compose.local.yml up -d`

3. Run migrations manually via Supabase CLI against the local Postgres

**Pros:** Full control
**Cons:** More manual setup, no built-in Supabase emulation (auth, RLS testing is harder)

---

## Option 3: SQLite for ultra-lightweight testing (Not recommended yet)

Use SQLite for unit/integration tests only (via Vitest + sqlite driver). Keep Supabase/Postgres for full integration.

---

## Integration with CI/CD workflow

### Before pushing:
```bash
npm run pre-push
# This runs:
# - npm run ci:local (lint + typecheck + test + build)
# - Environment validation
# - Mobile responsiveness check
```

### Migration safety checklist:
- [ ] Run `supabase db push` on local to test migration
- [ ] Run `npm run test` to verify RLS policies still work
- [ ] Review `.sql` diff in `supabase/migrations/` before committing
- [ ] Push to feature branch
- [ ] Once Vercel preview is green, prod migration is safe (migrations are idempotent)

---

## Troubleshooting

### "supabase start" fails
```bash
# Ensure Docker is running
docker ps

# Remove old containers and try again
supabase stop --no-backup
supabase start
```

### Local DB has stale data
```bash
supabase db reset
# Reapplies all migrations, clears data
```

### Migration applied to local but not prod
```bash
# Check migration status
supabase migration list --linked

# Push specific migration
supabase db push --dry-run
supabase db push
```

---

## Recommended next steps

1. **This week:** Install Supabase CLI + run `supabase start` once to verify Docker works
2. **Before next feature:** Set up `.env.local.dev` and link to prod project
3. **First feature with local DB:** Test a small migration locally before prod push
4. **Ongoing:** Use `supabase db reset` between features to start fresh

This removes prod migration risk and lets you iterate 10x faster.
