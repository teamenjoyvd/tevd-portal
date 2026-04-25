'use client'

import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDateTime } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient, ApiError } from '@/lib/apiClient'

interface TripMessage {
  id: string
  body: string
  created_at: string
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g
const TRAILING_PUNCT = /[.,;:!?)]+$/

function renderMessageBody(body: string): ReactNode {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  URL_PATTERN.lastIndex = 0
  while ((match = URL_PATTERN.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{body.slice(lastIndex, match.index)}</span>)
    }
    const rawUrl = match[0]
    const trailingMatch = rawUrl.match(TRAILING_PUNCT)
    const url = trailingMatch ? rawUrl.slice(0, rawUrl.length - trailingMatch[0].length) : rawUrl
    const trailing = trailingMatch ? trailingMatch[0] : ''
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-70 transition-opacity underline"
        style={{ color: 'var(--brand-teal)' }}
      >
        {url}
      </a>
    )
    if (trailing) {
      parts.push(<span key={`${match.index}-trail`}>{trailing}</span>)
    }
    lastIndex = match.index + rawUrl.length
  }
  if (lastIndex < body.length) {
    parts.push(<span key={lastIndex}>{body.slice(lastIndex)}</span>)
  }
  return <>{parts}</>
}

export function TripMessagesTile({ tripId }: { tripId: string }) {
  const { t } = useLanguage()

  const { data: messages, isLoading, isError, error, refetch, isFetching } =
    useQuery<TripMessage[], ApiError>({
      queryKey: ['trip-messages', tripId],
      queryFn: () => apiClient<TripMessage[]>(`/api/trips/${encodeURIComponent(tripId)}/messages`),
      retry: false,
      select: (data) =>
        [...data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    })

  if (isLoading) return null

  // 403 = not an approved attendee — expected, render nothing
  if (isError && error?.status === 403) return null

  // 5xx or network error — discreet retry, no alarming message
  if (isError) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderLeft: '3px solid var(--brand-teal)',
        }}
      >
        <div className="px-6 py-4 flex items-center justify-between">
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--brand-teal)' }}
          >
            {t('trips.messages')}
          </p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs hover:opacity-70 transition-opacity disabled:opacity-40"
            style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {isFetching ? t('trips.retrying') : t('trips.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!messages || messages.length === 0) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderLeft: '3px solid var(--brand-teal)',
      }}
    >
      <div className="px-6 pt-5 pb-2">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--brand-teal)' }}
        >
          {t('trips.messages')}
        </p>
      </div>
      <div className="px-6 pb-5">
        <div className="space-y-1 mt-1">
          {messages.map(m => (
            <div
              key={m.id}
              className="py-3 border-b last:border-0"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <p
                className="text-sm"
                style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {renderMessageBody(m.body)}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {formatDateTime(m.created_at)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
