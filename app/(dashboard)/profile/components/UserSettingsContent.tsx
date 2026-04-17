'use client'

import { memo } from 'react'
import { useTheme } from '@/lib/hooks/useTheme'
import { useFontSize, type FontSize } from '@/lib/hooks/useFontSize'
import { useLanguage } from '@/lib/hooks/useLanguage'

const FONT_STEPS: { value: FontSize; label: string; size: number }[] = [
  { value: 'md', label: 'A',  size: 16 },
  { value: 'lg', label: 'A',  size: 20 },
  { value: 'xl', label: 'A',  size: 24 },
]

export const UserSettingsContent = memo(function UserSettingsContent() {
  const { theme, mounted: themeMounted, toggle: toggleTheme } = useTheme()
  const { fontSize, setFontSize } = useFontSize()
  const { lang, toggle: toggleLang, t } = useLanguage()

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-5 pr-16" style={{ color: 'var(--brand-crimson)' }}>
        {t('profile.settings')}
      </p>

      <div className="space-y-5">
        {/* Theme */}
        <div>
          <p className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('profile.theme')}</p>
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map(th => {
              const active = themeMounted ? theme === th : th === 'light'
              return (
                <button
                  key={th}
                  onClick={toggleTheme}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: active ? 'var(--text-primary)' : 'transparent',
                    color: active ? 'var(--bg-card)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  {th === 'light' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4"/>
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                    </svg>
                  )}
                  {th === 'light' ? t('profile.theme.light') : t('profile.theme.dark')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Font size */}
        <div>
          <p className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('profile.textSize')}</p>
          <div className="flex gap-2">
            {FONT_STEPS.map(({ value, label, size }) => {
              const active = fontSize === value
              return (
                <button
                  key={value}
                  onClick={() => void setFontSize(value)}
                  className="flex-1 h-10 flex items-center justify-center rounded-xl transition-all"
                  style={{
                    backgroundColor: active ? 'var(--brand-crimson)' : 'transparent',
                    color: active ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                    border: active ? '1px solid transparent' : '1px solid var(--border-default)',
                    fontSize: size,
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                  aria-pressed={active}
                  aria-label={`Font size: ${value}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Language */}
        <div>
          <p className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('profile.language')}</p>
          <div className="flex gap-2">
            {(['en', 'bg'] as const).map(l => {
              const active = lang === l
              return (
                <button
                  key={l}
                  onClick={toggleLang}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: active ? 'var(--text-primary)' : 'transparent',
                    color: active ? 'var(--bg-card)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  {l === 'en' ? t('profile.lang.en') : t('profile.lang.bg')}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
})
