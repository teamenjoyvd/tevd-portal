'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()

  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: 'var(--bg-global)' }}
    >
      <p
        className="text-4xl mb-4"
        aria-hidden="true"
      >
        &#x26A0;
      </p>
      <h1
        className="font-display text-xl font-semibold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('error.title')}
      </h1>
      <p
        className="text-sm mb-6 max-w-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('error.desc')}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {t('error.retry')}
        </button>
        <a
          href="/"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-90"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {t('error.home')}
        </a>
      </div>
      {process.env.NODE_ENV !== 'production' && error.message && (
        <p
          className="mt-6 text-xs font-mono px-3 py-2 rounded-lg max-w-sm break-all"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
        >
          {error.message}
        </p>
      )}
    </div>
  )
}
