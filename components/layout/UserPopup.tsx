'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { useTheme } from '@/lib/hooks/useTheme'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

export default function UserPopup({
  open,
  onOpenChange,
  trigger,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactNode
}) {
  const { lang, toggle: toggleLang, t } = useLanguage()
  const { theme, mounted: themeMounted, toggle: toggleTheme } = useTheme()

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        style={{ minWidth: 180, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      >
        <Link
          href="/sign-in"
          className="flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--brand-crimson)', color: 'white' }}
          onClick={() => onOpenChange(false)}
        >
          {t('nav.signIn')}
        </Link>

        <div className="h-px w-full" style={{ backgroundColor: 'var(--border-default)' }} />

        {/* Language */}
        <button
          onClick={toggleLang}
          className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-global)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span style={{ color: 'var(--text-secondary)' }} className="text-xs uppercase tracking-widest">
            Language
          </span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          >
            {lang === 'en' ? 'EN' : 'BG'}
          </span>
        </button>

        {/* Theme */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-global)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span style={{ color: 'var(--text-secondary)' }} className="text-xs uppercase tracking-widest">
            Theme
          </span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          >
            {!themeMounted ? '\u2026' : theme === 'light' ? '\uD83C\uDF19' : '\u2600\uFE0F'}
          </span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
