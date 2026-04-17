'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'

export const CALENDAR_MIN_HEIGHT = 160

export function CalendarSection({ profileId }: { profileId: string }) {
  const { t } = useLanguage()
  const [calCopied, setCalCopied] = useState(false)

  const { data: calData, refetch: refetchCal } = useQuery<{ url: string }>({
    queryKey: ['cal-feed-token'],
    queryFn: () => fetch('/api/calendar/feed-token').then(r => r.json()),
    enabled: !!profileId,
    staleTime: Infinity,
  })

  const regenerateCal = useMutation({
    mutationFn: () => fetch('/api/calendar/feed-token', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => refetchCal(),
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

  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>{t('profile.calSub')}</p>
      <p className="text-xs mb-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('profile.calSubDesc')}</p>
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('profile.calSubInstructions')}</p>
      <div className="flex items-center gap-2">
        <input readOnly value={calData?.url ?? ''} placeholder="Generating…"
          className="flex-1 border rounded-xl px-3 py-2 text-xs font-mono truncate"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-global)' }} />
        <button onClick={handleCopy} disabled={!calData?.url}
          className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 hover:opacity-80 flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}>
          {calCopied ? t('profile.calSubCopied') : t('profile.calSubCopy')}
        </button>
        <button onClick={handleRegenerate} disabled={regenerateCal.isPending}
          className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 disabled:opacity-40 flex-shrink-0"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {t('profile.calSubRegenerate')}
        </button>
      </div>
    </div>
  )
}
