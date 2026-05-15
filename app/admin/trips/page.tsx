import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function TripsListPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  const { data: trips = [] } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, total_cost')
    .order('start_date', { ascending: true })

  return (
    <div className="space-y-6 pb-16">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Trips
        </h1>
        <Link
          href="/admin/trips/new"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          New Trip
        </Link>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block">
        {trips.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No trips yet.</p>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  {['Title', 'Destination', 'Dates', 'Cost'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trips.map((trip, i) => (
                  <tr
                    key={trip.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}
                  >
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      <Link href={`/admin/trips/${trip.id}`} className="hover:underline">
                        {trip.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{trip.destination}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {formatCurrency(trip.total_cost, 'EUR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Mobile card stack ── */}
      <div className="md:hidden space-y-3">
        {trips.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No trips yet.</p>
        ) : (
          trips.map(trip => (
            <Link
              key={trip.id}
              href={`/admin/trips/${trip.id}`}
              className="block rounded-2xl p-4 space-y-1"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{trip.title}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {trip.destination} · {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {formatCurrency(trip.total_cost, 'EUR')}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
