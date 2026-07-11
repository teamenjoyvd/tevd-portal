# Lean Development Workflow

This document explains the optimized dev process to minimize GitHub noise and iteration cycles.

## Quick reference

| Command | What it does | When to use |
|---------|-----------|-----------|
| `npm run dev` | Start next-dev on port 3000 | Always when coding |
| `npm run ci:local` | Runs full CI suite locally (lint + typecheck + test + build) | Before git push |
| `npm run pre-push` | Interactive checklist before pushing | Before `git push` |
| `npm run check:env` | Validates all required env vars are set | On first run, or if env errors |
| `npm run test:mobile` | Checks all routes render at 390px | Before feature push |
| `npm run cleanup:branches` | Lists stale/merged branches | Weekly cleanup |

## The workflow

### Phase 1: Local iteration (next-dev is your primary verification)

**Do this for every feature:**

```bash
# 1. Start dev server (stays running)
npm run dev

# 2. Make code changes
# 3. Browser auto-reloads (HMR)
# 4. Test in browser:
#    - Full desktop view
#    - 390px mobile view (resize browser or use devtools)
#    - Dark mode toggle
#    - Clerk sign-in/auth (use prod user account if available)

# 5. Run local checks (in a new terminal)
npm run lint        # catch style issues
npm run check-types # catch type errors
npm run test        # run unit tests

# 6. Commit when all local checks pass
git add .
git commit -m "Feature: description"
```

**Key insight:** Don't push until you're confident. Local iteration is free; Vercel iteration costs 5 min per cycle.

---

### Phase 2: Pre-push verification (catch issues before GitHub)

**Before `git push origin <branch>`:**

```bash
# Run the full checklist
npm run pre-push

# This runs:
# ✅ check:env         (env vars present)
# ✅ lint              (style issues)
# ✅ check-types       (type errors)
# ✅ test              (unit tests)
# ✅ build             (production build)
# ⚠️  test:mobile      (390px rendering)
# ⚠️  audit:deps       (dependency vulnerabilities)

# If all critical checks pass (marked ✅), push:
git push origin feature/my-feature
```

---

### Phase 3: Vercel verification (quick final check)

**After pushing:**

1. GitHub creates PR automatically (via branch naming: `dev/[YYMM]-DEV-[GH#]`)
2. Vercel preview builds in ~2 min
3. CI checks run automatically
4. You receive notifications — don't refresh manually

**If preview is green:**
- Feature is done, ready to merge
- No iteration cycles needed

**If preview fails:**
- Check Vercel logs + GitHub CI status
- Fix locally (`npm run build` simulates Vercel)
- Re-run `npm run pre-push`
- Push again

---

## Clerk authentication in next-dev

**To test with production Clerk user:**

1. Open `http://localhost:3000` in browser
2. Click "Sign in or change language" (top right)
3. Sign in with your Clerk prod account
4. Credentials persist in browser cookies/localStorage
5. Subsequent page loads keep you signed in

**Note:** Cookies are per-browser-session. Restarting next-dev doesn't affect auth state.

---

## Checking branches and cleanup

```bash
# See old/merged branches
npm run cleanup:branches

# Delete a branch locally
git branch -D <branch-name>

# Delete on GitHub
gh branch delete <branch-name>
```

Cleanup weekly to avoid branch clutter.

---

## Local database (optional but recommended)

See [LOCAL-DB-SETUP.md](./LOCAL-DB-SETUP.md) for zero-risk migration testing.

TL;DR:
```bash
supabase start                # Spins up local Postgres + Supabase emulator
supabase db pull             # Downloads prod migrations
npm run dev                  # Dev server uses local DB
supabase db reset            # Between features: clean slate
```

---

## Environment variables

Required vars are validated on `npm run check:env`. All are stored in `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...  (test or prod)
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
ICAL_TOKEN_SECRET=<32 hex chars>
NEXT_PUBLIC_APP_URL=https://tevd-portal.vercel.app
```

If missing, `npm run check:env` will tell you which ones.

---

## Troubleshooting

### "supabaseUrl is required"
- `.env.local` is missing or not loaded
- Solution: `npm run check:env` to diagnose, copy `.env.local` to worktree if using git worktree

### Build succeeds locally but fails on Vercel
- Run `npm run build` locally to simulate Vercel
- Check Vercel logs in GitHub PR for the actual error

### Type errors in IDE but tests pass
- Run `npm run check-types` — vitest might have different ts config
- Check `tsconfig.json` vs `vitest.config.ts`

### Mobile view doesn't look right
- Open `http://localhost:3000` → F12 → Toggle device toolbar → Set to 390px width
- Or run `npm run test:mobile` for automated check

---

## Summary: Why this is faster

| Old approach | New approach | Savings |
|--|--|--|
| Code → Push → Vercel (5 min) → Fail → Fix → Push → Vercel (5 min) = 10 min | Code → Local check (instant) → Build (2 min) → Push → Vercel (2 min) = 4 min | **6 min per cycle** |
| 3 failed pushes before success = 30 min | Local checks catch issues before push = 1 successful push | **20 min per feature** |

**Result:** Leaner GitHub, faster iteration, fewer PR revisions.
