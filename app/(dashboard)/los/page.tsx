'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import PageHeading from '@/components/layout/PageHeading'
import PageContainer from '@/components/layout/PageContainer'

type LOSPerson = {
  abo_number: string
  name: string
  role: string
  abo_level: string | null
}

type DownlinePerson = LOSPerson & { relative_level: number }

type LOSData = {
  current_user: LOSPerson & { id: string }
  upline: LOSPerson[]
  downlines: DownlinePerson[]
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  admin:  { bg: '#2d332a',              color: '#FAF8F3' },
  core:   { bg: '#3E7785',              color: '#FAF8F3' },
  member: { bg: 'rgba(62,119,133,0.15)', color: '#3E7785' },
  guest:  { bg: 'rgba(0,0,0,0.06)',     color: '#8A8577' },
}

function RoleBadge({ role }: { role: string }) {
  const rs = ROLE_STYLES[role] ?? ROLE_STYLES.guest
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: rs.bg, color: rs.color }}>
      {role}
    </span>
  )
}

function PersonRow({
  person,
  isRoot = false,
  isLast = false,
}: {
  person: LOSPerson
  isRoot?: boolean
  isLast?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Vertical connector line */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
        {!isRoot && <div className="w-px flex-1" style={{ backgroundColor: 'var(--border-default)', minHeight: 16 }} />}
        <div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-stone)' }} />
        {!isLast && <div className="w-px flex-1" style={{ backgroundColor: 'var(--border-default)', minHeight: 16 }} />}
      </div>
      <div className="flex items-center gap-2 py-2 flex-1 min-w-0">
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {person.name}
        </span>
        <RoleBadge role={person.role} />
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
          #{person.abo_number}
        </span>
        {person.abo_level && (
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
            L{person.abo_level}
          </span>
        )}
      </div>
    </div>
  )
}

export default function LOSPage() {
  const { t } = useLanguage()
  const router = useRouter()

  const { data, isLoading, error } = useQuery<LOSData | { error: string }>({
    queryKey: ['los-member'],
    queryFn: () => fetch('/api/los').then(r => r.json()),
    retry: false,
  })

  useEffect(() => {
    if (data && 'error' in data && (data as { error: string }).error === 'Forbidden') {
      router.replace('/')
    }
  }, [data, router])

  const losData = data && !('error' in data) ? data as LOSData : null

  // Group downlines by relative_level
  const downlinesByLevel: Record<number, DownlinePerson[]> = {}
  for (const d of losData?.downlines ?? []) {
    if (!downlinesByLevel[d.relative_level]) downlinesByLevel[d.relative_level] = []
    downlinesByLevel[d.relative_level].push(d)
  }
  const levels = Object.keys(downlinesByLevel).map(Number).sort((a, b) => a - b)

  return (
    <>
      <PageHeading title={t('los.title')} subtitle={t('los.subtitle')} />
      <PageContainer>
        <div className="max-w-2xl py-8 pb-16">

          {isLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
              ))}
            </div>
          )}

          {!isLoading && !losData && (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
              {t('los.noNetwork')}
            </p>
          )}

          {losData && (
            <div className="space-y-8">

              {/* Upline chain */}
              {losData.upline.length > 0 && (
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                    style={{ color: 'var(--brand-crimson)' }}>
                    {t('los.upline')}
                  </p>
                  <div className="rounded-xl border px-4 py-2"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'white' }}>
                    {losData.upline.map((p, i) => (
                      <PersonRow
                        key={p.abo_number}
                        person={p}
                        isRoot={i === 0}
                        isLast={false}
                      />
                    ))}
                    {/* Connector from last upline to self */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
                        <div className="w-px" style={{ backgroundColor: 'var(--border-default)', height: 12 }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Current user */}
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                  style={{ color: 'var(--brand-crimson)' }}>
                  {t('los.you')}
                </p>
                <div className="rounded-xl border px-4 py-3 flex items-center gap-3"
                  style={{
                    borderColor: 'rgba(188,71,73,0.30)',
                    backgroundColor: 'rgba(188,71,73,0.04)',
                  }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{ backgroundColor: 'var(--brand-crimson)', color: 'white' }}>
                    {losData.current_user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {losData.current_user.name}
                    </span>
                    <RoleBadge role={losData.current_user.role} />
                    {losData.current_user.abo_number && (
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        #{losData.current_user.abo_number}
                      </span>
                    )}
                    {losData.current_user.abo_level && (
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        L{losData.current_user.abo_level}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Downlines */}
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                  style={{ color: 'var(--brand-crimson)' }}>
                  {t('los.downlines')}
                </p>

                {levels.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>
                    {t('los.noDownlines')}
                  </p>
                ) : (
                  <div className="space-y-6">
                    {levels.map(level => (
                      <div key={level}>
                        <p className="text-xs font-semibold mb-2"
                          style={{ color: 'var(--text-secondary)' }}>
                          {t('los.level')} {level}
                        </p>
                        <div className="rounded-xl border overflow-hidden"
                          style={{ borderColor: 'var(--border-default)' }}>
                          {downlinesByLevel[level].map((person, i) => (
                            <div
                              key={person.abo_number}
                              className="flex items-center gap-3 px-4 py-3"
                              style={{
                                borderBottom: i < downlinesByLevel[level].length - 1
                                  ? '1px solid var(--border-default)'
                                  : 'none',
                                backgroundColor: i % 2 === 0 ? 'white' : 'var(--bg-global)',
                              }}
                            >
                              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate"
                                  style={{ color: 'var(--text-primary)' }}>
                                  {person.name}
                                </span>
                                <RoleBadge role={person.role} />
                                <span className="text-xs flex-shrink-0"
                                  style={{ color: 'var(--text-secondary)' }}>
                                  #{person.abo_number}
                                </span>
                                {person.abo_level && (
                                  <span className="text-xs flex-shrink-0"
                                    style={{ color: 'var(--text-secondary)' }}>
                                    L{person.abo_level}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </PageContainer>
    </>
  )
}
