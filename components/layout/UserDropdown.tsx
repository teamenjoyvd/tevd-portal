'use client'

import { useRef, useState, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { getRoleColors } from '@/lib/role-colors'

const ROLE_LABELS: Record<string, string> = {
  admin:  'Admin',
  core:   'Core',
  member: 'Member',
  guest:  'Guest',
}

type ProfileData = {
  id: string
  first_name: string
  last_name: string
  role: string
  abo_number: string | null
}

export default function UserDropdown() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const { lang, toggle } = useLanguage()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Theme state — synced with ThemeTile via localStorage + storage event
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [themeMounted, setThemeMounted] = useState(false)
  useEffect(() => {
    const stored = localStorage.getItem('tevd-theme') as 'light' | 'dark' | null
    setTheme(stored ?? 'light')
    setThemeMounted(true)
    function onStorage(e: StorageEvent) {
      if (e.key === 'tevd-theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('tevd-theme', next)
    document.documentElement.setAttribute('data-theme', next)
    // Notify ThemeTile and any other tab via storage event
    window.dispatchEvent(new StorageEvent('storage', { key: 'tevd-theme', newValue: next }))
  }

  const role = (user?.publicMetadata?.role as string) ?? 'guest'
  const isAdmin = role === 'admin'

  // Read name from TanStack Query cache (populated by /api/profile).
  // This is always fresh after a profile save because saveMutation.onSuccess
  // calls qc.setQueryData(['profile'], data).
  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const firstName = profileData?.first_name || user?.firstName || ''
  const lastName  = profileData?.last_name  || user?.lastName  || ''
  const initials  = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?'
  const fullName  = `${firstName} ${lastName}`.trim() || 'Member'

  const { data: uplineData } = useQuery<{ upline_name: string | null }>({
    queryKey: ['profile-upline'],
    queryFn: () => fetch('/api/profile/upline').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: verRequest } = useQuery<{ status: string } | null>({
    queryKey: ['verify-abo'],
    queryFn: () => fetch('/api/profile/verify-abo').then(r => r.json()),
    enabled: role === 'guest',
    staleTime: 5 * 60 * 1000,
  })

  const isUnverified = role === 'guest' &&
    !!verRequest &&
    (verRequest.status === 'pending' || verRequest.status === 'denied')

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

  const roleColors = getRoleColors(role)

  return (
    <div ref={containerRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white transition-opacity hover:opacity-80 active:opacity-60 flex-shrink-0"
        style={{ backgroundColor: 'var(--brand-forest)', border: '1.5px solid rgba(0,0,0,0.1)' }}
        aria-label="Account menu"
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-2xl z-50 overflow-hidden"
          style={{
            width: 220,
            backgroundColor: 'white',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          {/* Identity block */}
          <div className="px-4 py-4 border-b border-black/5">
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
            {uplineData?.upline_name && (
              <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-medium">Upline</span>{' '}
                {uplineData.upline_name}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="py-1.5">
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03]"
                style={{ color: 'var(--text-primary)' }}
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
            )}
            <div className="border-t flex items-center justify-between px-4 py-2.5"
              style={{ borderColor: 'var(--border-default)' }}>
              <span className="text-sm font-body" style={{ color: 'var(--text-secondary)' }}>
                {lang === 'en' ? 'Language' : 'Език'}
              </span>
              <button
                onClick={toggle}
                className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors hover:bg-black/5"
                style={{ color: 'var(--text-secondary)' }}
              >
                {lang === 'en' ? 'БГ' : 'EN'}
              </button>
            </div>
            <div className="border-t flex items-center justify-between px-4 py-2.5"
              style={{ borderColor: 'var(--border-default)' }}>
              <span className="text-sm font-body" style={{ color: 'var(--text-secondary)' }}>
                {themeMounted ? (theme === 'light' ? 'Light mode' : 'Dark mode') : 'Theme'}
              </span>
              <button
                onClick={toggleTheme}
                className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors hover:bg-black/5"
                style={{ color: 'var(--text-secondary)' }}
              >
                {!themeMounted ? '…' : theme === 'light' ? '🌙' : '☀️'}
              </button>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03] border-t"
              style={{ color: 'var(--brand-crimson)', borderColor: 'var(--border-default)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
