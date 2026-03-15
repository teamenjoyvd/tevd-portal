import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

---

**Vercel env vars — paste these into Settings → Environment Variables (all environments):**
```
NEXT_PUBLIC_SUPABASE_URL=https://ynykjpnetfwqzdnsgkkg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your clerk key>
CLERK_SECRET_KEY=<your clerk key>