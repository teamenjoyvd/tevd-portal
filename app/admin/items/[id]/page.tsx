import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ItemMetaForm } from './components/ItemMetaForm'
import { ItemStatusSection } from './components/ItemStatusSection'
import type { PayableItem } from '@/lib/types/items'

export const dynamic = 'force-dynamic'

export default async function ItemManagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: itemId } = await params

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  const { data: item } = await supabase
    .from('payable_items')
    .select('*, trips(title)')
    .eq('id', itemId)
    .single()

  if (!item) redirect('/admin/items')

  const typedItem = item as unknown as PayableItem

  return (
    <div className="space-y-6 pb-16">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/items"
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Items
        </Link>
        <span style={{ color: 'var(--text-secondary)' }}>/</span>
        <h1
          className="font-display text-2xl font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {item.title}
        </h1>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden md:block max-w-xl space-y-6">
        <ItemMetaForm item={typedItem} />
        <ItemStatusSection item={typedItem} />
      </div>

      {/* ── Mobile layout ── */}
      <div className="md:hidden flex flex-col gap-6">
        <ItemMetaForm item={typedItem} />
        <ItemStatusSection item={typedItem} />
      </div>
    </div>
  )
}
