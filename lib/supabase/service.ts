import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Module-level singleton — reused across invocations in the same serverless instance
// Prevents cold-start connection timeouts on the Clerk webhook and other service routes
let _client: ReturnType<typeof createClient<Database>> | null = null

export function createServiceClient() {
  if (!_client) {
    _client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _client
}
