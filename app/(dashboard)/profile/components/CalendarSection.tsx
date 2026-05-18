'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, RefreshCw, Save } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'
import { type Profile } from '../types'

export const CALENDAR_MIN_HEIGHT = 160

const DEFAULT_CALENDAR_NAME = 'teamenjoyVD'

export function CalendarSection({ profileId }: { profileId: string }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [calCopied, setCalCopied] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  // Read existing ical_display_name from the profile query cache (populated by ProfileClient)
  const { data: fullProfile } = useQuery<Profile>({
    queryKey: ['profile'],
    enabled: false,
  })

  useEffect(() => {
    if (!fullProfile) return
    const prefs = (fullProfile.ui_prefs ?? {}) as Record<string, unknown>
    setDisplayName((prefs.ical_display_name as string | undefined) ?? '')
  }, [fullProfile?.id])

  const { data: calData, refetch: refetchCal } = useQuery<{ url: string }>({
    queryKey: ['cal-feed-token'],
    queryFn: () => apiClient('/api/calendar/feed-token'),
    enabled: !!profileId,
    staleTime: Infinity,
  })

  const regenerateCal = useMutation({
    mutationFn: () => apiClient('/api/calendar/feed-token', { method: 'POST' }),
    onSuccess: () => refetchCal(),
  })

  const saveDisplayName = useMutation({
    mutationFn: (name: string) =>
      apiClient('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ui_prefs: { ical_display_name: name || null } }),
      }),
    onSuccess: () => {
      // Invalidate profile cache so remounts and other sections see fresh ui_prefs
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    },
  })

  const handleCopy = useCallback(() => {
    if (calData?.url) {
      navigator.clipboard.writeText(calData.url)
      setCalCopied(true)
      setTimeout(() => setCalCopied(false), 2000)
    }
  }, [calData])

  const handleRegenerate = useCallback(() => {
    if (confirm('Regenerate your calendar link? Your old link will stop working.')) regenerateCal.mutate()
  }, [regenerateCal])

  const handleSaveName = useCallback(() => {
    saveDisplayName.mutate(displayName)
  }, [displayName, saveDisplayName])

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>{t('profile.calSub')}</p>
      <p className="text-xs mb-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('profile.calSubDesc')}</p>
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('profile.calSubInstructions')}</p>

      {/* Feed URL row */}
      <div className="flex items-center gap-2">
        <input readOnly value={calData?.url ?? ''} placeholder="Generating…"
          className="flex-1 min-w-0 border rounded-xl px-3 py-2 text-xs font-mono truncate"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-global)' }} />
        <button
          onClick={handleCopy}
          disabled={!calData?.url || regenerateCal.isPending}
          aria-label={calCopied ? t('profile.calSubCopied') : t('profile.calSubCopy')}
          className="p-2 rounded-xl transition-all disabled:opacity-40 hover:opacity-80 flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
        >
          {calCopied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerateCal.isPending}
          aria-label={t('profile.calSubRegenerate')}
          aria-busy={regenerateCal.isPending}
          className="p-2 rounded-xl border transition-colors hover:bg-black/5 disabled:opacity-40 flex-shrink-0"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={14} className={regenerateCal.isPending ? 'motion-safe:animate-spin' : ''} />
        </button>
      </div>

      {/* Display name row */}
      <div className="mt-3">
        <p className="text-xs mb-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t('profile.calDisplayNameDesc')}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={t('profile.calDisplayNamePlaceholder')}
            maxLength={64}
            className="flex-1 min-w-0 border rounded-xl px-3 py-2 text-xs truncate"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
          />
          <button
            onClick={handleSaveName}
            disabled={saveDisplayName.isPending}
            aria-label={nameSaved ? t('profile.saved') : t('profile.calDisplayNameSave')}
            className="p-2 rounded-xl transition-all disabled:opacity-40 hover:opacity-80 flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
          >
            {nameSaved ? <Check size={14} /> : <Save size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
