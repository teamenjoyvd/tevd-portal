'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { useTheme } from '@/lib/hooks/useTheme'
import { useFontSize, type FontSize } from '@/lib/hooks/useFontSize'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

// Exposed font sizes — sm is legacy (kept in type/cookie for compat) but not offered in UI
const FONT_STEPS: { value: FontSize; label: string }[] = [
  { value: 'md', label: 'Default' },
  { value: 'lg', label: '+1' },
  { value: 'xl', label: '+2' },
]

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
  const { fontSize, setFontSize, resetFontSize } = useFontSize()

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

        {/* Font size */}
        <div className="flex items-center justify-between px-3 py-1">
          <span style={{ color: 'var(--text-secondary)' }} className="text-xs uppercase tracking-widest">
            Text size
          </span>
          <div className="flex items-center gap-1">
            {FONT_STEPS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => void setFontSize(value)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-xs font-bold transition-colors"
                style={{
                  backgroundColor: fontSize === value ? 'var(--brand-crimson)' : 'var(--bg-global)',
                  color: fontSize === value ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                }}
                aria-pressed={fontSize === value}
                aria-label={`Font size ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {fontSize !== 'md' && (
          <button
            onClick={() => void resetFontSize()}
            className="text-xs text-center transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand-crimson)' }}
          >
            Reset text size
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
