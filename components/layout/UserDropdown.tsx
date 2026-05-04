'use client'

import { useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { useTheme } from '@/lib/hooks/useTheme'
import { getRoleColors } from '@/lib/role-colors'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

const ROLE_LABELS: Record<string, string> = {
  admin:  'Admin',
  core:   'Core',
  member: 'Member',
  guest:  'Guest',
}

type VerRequest = {
  id: string
  claimed_abo: string
  claimed_upline_abo: string
  status: string
  admin_note: string | null
  created_at: string
  request_type: string
} | null

type ProfileData = {
  id: string
  first_name: string
  last_name: string
  role: string
  abo_number: string | null
  upline: { upline_name: string | null; upline_abo_number: string | null } | null
  verRequest: VerRequest
}

export default function UserDropdown() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const { lang, toggle: toggleLang } = useLanguage()
  const { theme, mounted: themeMounted, toggle: toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  // Role sourced from DB via profile query — single source of truth
  const role = profileData?.role ?? 'guest'
  const isAdmin = role === 'admin'

  const firstName = profileData?.first_name || user?.firstName || ''
  const lastName  = profileData?.last_name  || user?.lastName  || ''
  const initials  = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?'
  const fullName  = `${firstName} ${lastName}`.trim() || 'Member'

  const uplineName = profileData?.upline?.upline_name ?? null

  const verRequest = profileData?.verRequest ?? null
  const isUnverified = role === 'guest' &&
    !!verRequest &&
    (verRequest.status === 'pending' || verRequest.status === 'denied')

  const roleColors = getRoleColors(role)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white transition-opacity hover:opacity-80 active:opacity-60 flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-forest)', border: '1.5px solid rgba(0,0,0,0.1)' }}
          aria-label="Account menu"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {/* Identity block */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: 'var(--brand-forest)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {fullName}
              </p>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block"
                style={{ backgroundColor: roleColors.bg, color: roleColors.font }}
              >
                {isUnverified ? 'Unverified Member' : (ROLE_LABELS[role] ?? role)}
              </span>
            </div>
          </div>
          {uplineName && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-medium">Upline</span>{' '}
              {uplineName}
            </p>
          )}
        </div>

        {/* Actions */}
        <div>
          {isAdmin && (
            <DropdownMenuItem asChild>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-global)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="7" height="9" x="3" y="3" rx="1"/>
                  <rect width="7" height="5" x="14" y="3" rx="1"/>
                  <rect width="7" height="9" x="14" y="12" rx="1"/>
                  <rect width="7" height="5" x="3" y="16" rx="1"/>
                </svg>
                Admin
              </Link>
            </DropdownMenuItem>
          )}

          {/* Language — borderTop only when Admin row is above it */}
          <DropdownMenuItem
            onSelect={e => e.preventDefault()}
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              borderTop: isAdmin ? '1px solid var(--border-default)' : '0px solid transparent',
              cursor: 'default',
            }}
          >
            <span className="text-sm font-body" style={{ color: 'var(--text-secondary)' }}>
              {lang === 'en' ? 'Language' : 'Език'}
            </span>
            <button
              onClick={toggleLang}
              className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-global)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border-default)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-global)')}
            >
              {lang === 'en' ? 'БГ' : 'EN'}
            </button>
          </DropdownMenuItem>

          {/* Theme */}
          <DropdownMenuItem
            onSelect={e => e.preventDefault()}
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderTop: '1px solid var(--border-default)', cursor: 'default' }}
          >
            <span className="text-sm font-body" style={{ color: 'var(--text-secondary)' }}>
              {themeMounted ? (theme === 'light' ? 'Light mode' : 'Dark mode') : 'Theme'}
            </span>
            <button
              onClick={toggleTheme}
              className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-global)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border-default)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-global)')}
            >
              {!themeMounted ? '…' : theme === 'light' ? '🌙' : '☀️'}
            </button>
          </DropdownMenuItem>

          {/* Sign out */}
          <DropdownMenuItem asChild>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
              style={{ color: 'var(--brand-crimson)', borderTop: '1px solid var(--border-default)', backgroundColor: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-global)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
              Sign out
            </button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
