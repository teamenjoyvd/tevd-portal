import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Returns a fresh client on every call — no module-level singleton.
// Singleton pattern risks auth-header contamination across warm
// lambda requests when the same instance handles multiple users.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
