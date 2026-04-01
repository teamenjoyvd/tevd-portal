import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Args for the upsert_tree_node Postgres function.
 *
 * The generated type declares p_abo_number as `string`, but the function
 * intentionally accepts NULL to trigger the no-ABO placeholder path
 * (node label becomes `p_<uuid>`). The helper encapsulates the single
 * cast required to bridge this gap so call sites stay clean.
 */
export interface UpsertTreeNodeArgs {
  p_profile_id: string
  p_abo_number: string | null
  p_sponsor_abo_number?: string | null
}

export async function upsertTreeNode(
  supabase: SupabaseClient<Database>,
  args: UpsertTreeNodeArgs
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    // Generated types declare p_abo_number as string, but the function
    // accepts NULL to produce a placeholder label. One cast here keeps
    // all call sites type-safe.
    .rpc('upsert_tree_node', args as unknown as Parameters<typeof supabase.rpc<'upsert_tree_node'>>[1])
  return { error: error ?? null }
}
