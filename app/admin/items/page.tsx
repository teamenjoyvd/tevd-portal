import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'

export const dynamic = 'force-dynamic'

function resolveTrip(trips: unknown): { title: string } | null {
  if (!trips) return null
  if (Array.isArray(trips)) return trips[0] ?? null
  return trips as { title: string }
}

export default async function ItemsListPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  const { data } = await supabase
    .from('payable_items')
    .select('id, title, amount, currency, item_type, is_active, linked_trip_id, trips(title)')
    .order('created_at', { ascending: false })

  const items = data ?? []

  return (
    <div className="space-y-6 pb-16">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Items
        </h1>
        <Link
          href="/admin/items/new"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          New Item
        </Link>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block">
        {items.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No items yet.</p>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  {['Title', 'Type', 'Amount', 'Linked Trip', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const trip = resolveTrip(item.trips)
                  return (
                    <tr
                      key={item.id}
                      style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}
                    >
                      <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                        <Link href={`/admin/items/${item.id}`} className="hover:underline">
                          {item.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{item.item_type}</td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                        {formatCurrency(item.amount, item.currency)}
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                        {trip?.title ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: item.is_active ? '#81b29a33' : 'rgba(0,0,0,0.06)',
                            color: item.is_active ? '#2d6a4f' : 'var(--text-secondary)',
                          }}
                        >
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Mobile card stack ── */}
      <div className="md:hidden space-y-3">
        {items.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No items yet.</p>
        ) : (
          items.map(item => {
            const trip = resolveTrip(item.trips)
            return (
              <Link
                key={item.id}
                href={`/admin/items/${item.id}`}
                className="block rounded-2xl p-4 space-y-1"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: item.is_active ? '#81b29a33' : 'rgba(0,0,0,0.06)',
                      color: item.is_active ? '#2d6a4f' : 'var(--text-secondary)',
                    }}
                  >
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {item.item_type} · {formatCurrency(item.amount, item.currency)}
                  {trip && ` · ${trip.title}`}
                </p>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
