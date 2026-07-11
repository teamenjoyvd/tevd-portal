# Local Supabase Setup — Quick Start

This guide sets up a **zero-risk local database** for testing migrations before prod. Takes ~15 min one-time.

## Prerequisites

1. **Docker Desktop** — [Download](https://www.docker.com/products/docker-desktop) (free, runs locally)
2. **Supabase CLI** — Install after Docker is running

## Installation (Windows)

### 1. Install Docker Desktop
```bash
# Download and run installer from: https://www.docker.com/products/docker-desktop
# Start Docker Desktop from Start menu
# Verify: docker --version
```

### 2. Install Supabase CLI
```powershell
# Option A: Scoop (recommended on Windows)
scoop install supabase

# Option B: npm
npm install -g @supabase/cli

# Verify
supabase --version
```

## Setup Local Supabase (5 min)

### 1. Start local Supabase stack
```bash
cd D:\react\teamenjoyvd\tevd-portal
supabase start
```

**First run takes 2-3 min** (downloads Docker images). Output will show:
```
API URL: http://localhost:54321
Anon Key: eyJ...
Service Key: eyJ...
```

### 2. Create `.env.local.dev` for local testing
```bash
# Copy your current .env.local as a template
cp .env.local .env.local.dev

# Edit .env.local.dev and replace ONLY these 3 lines:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<copy from supabase start output>

# Keep everything else (Clerk, Mapbox, etc.) the same
```

### 3. Pull prod migrations
```bash
supabase link --project-ref ynykjpnetfwqzdnsgkkg
supabase db pull
```

This downloads all your prod migrations into `supabase/migrations/`.

### 4. Apply migrations to local DB
```bash
supabase db push
```

### 5. (Optional) Seed test data
Create `supabase/seed.sql`:
```sql
-- Insert test users
INSERT INTO public.profiles (id, clerk_id, role) 
VALUES 
  ('test-user-1', 'user_test1', 'member'),
  ('test-admin-1', 'user_admin1', 'admin')
ON CONFLICT DO NOTHING;
```

Then seed:
```bash
supabase db push --dry-run  # preview first
supabase db push           # apply
```

## Daily Workflow

```bash
# Start of day
supabase start

# Develop (with local DB, no prod risk)
npm run dev

# Between features — reset local DB to clean state
supabase db reset

# Before pushing — test migration safely
supabase db push
npm run test
npm run pre-push
git push

# End of day
supabase stop
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `supabase start` fails | Ensure Docker Desktop is running (check system tray) |
| Docker not found | Add Docker to PATH or restart terminal after install |
| Port 54321 already in use | `supabase stop`, then try again |
| Migration applied locally but failed on prod | Check `supabase migrations list --linked` to compare versions |

## Safety Guarantees

✅ **No prod risk** — Local DB is isolated in Docker, zero access to prod data  
✅ **Test migrations first** — Catch breakage before Vercel  
✅ **Instant reset** — `supabase db reset` wipes local state between features  
✅ **Same schema** — Local migrations are the real prod SQL, not mocked  

## Reference

- [Supabase CLI Docs](https://supabase.com/docs/guides/local-development)
- [Local Development Guide](https://supabase.com/docs/guides/getting-started/local-development)

---

**Once installed, you're done.** Just run `supabase start` before dev and `supabase stop` at end of day.
