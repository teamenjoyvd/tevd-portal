'use client'

import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/format'
import { BackButton } from './shared'
import type { TripProfile } from '../page'

export function LockedView({ profile }: { profile: TripProfile }) {
  const router = useRouter()
  const docLabel = profile.document_active_type === 'passport' ? 'Passport' : 'ID Card'
  const expiryText = profile.valid_through
    ? `expires ${formatDate(profile.valid_through)}`
    : 'no expiry date on file'

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[720px] mx-auto px-4">
        <BackButton />
        <div className="rounded-2xl px-6 py-8"
          style={{ backgroundColor: 'rgba(188,71,73,0.08)', border: '1px solid rgba(188,71,73,0.25)' }}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="#bc4749" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold mb-1" style={{ color: '#bc4749' }}>
                Action Required: Update Travel Documents
              </p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                Your {docLabel} ({expiryText}) must be valid for at least 90 days to register for a trip.
                Update your documents in your profile to unlock trip registration.
              </p>
              <button
                onClick={() => router.push('/profile')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#bc4749' }}
              >
                Go to Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
