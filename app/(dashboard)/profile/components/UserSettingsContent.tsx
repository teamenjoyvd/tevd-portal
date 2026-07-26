'use client'

import { memo } from 'react'
import { Settings, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/hooks/useTheme'
import { useFontSize, type FontSize } from '@/lib/hooks/useFontSize'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { BentoHeader } from './BentoHeader'

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
    <div>
      <BentoHeader icon={Settings} title={t('profile.settings')} />

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
                  {th === 'light' ? <Sun size={12} /> : <Moon size={12} />}
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
