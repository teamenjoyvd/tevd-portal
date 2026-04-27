'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'
import type { UnrecognizedRow, ManualMemberNoAbo } from '@/lib/csv-import'

export function ReconciliationPanel({
  initialUnrecognized,
  initialProfiles,
}: {
  initialUnrecognized: UnrecognizedRow[]
  initialProfiles: ManualMemberNoAbo[]
}) {
  const { t } = useLanguage()
  const [unrecognized, setUnrecognized] = useState(initialUnrecognized)
  const [profiles, setProfiles] = useState(initialProfiles)
  const [selectedLos, setSelectedLos] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  if (unrecognized.length === 0 && profiles.length === 0) return null

  const selectedLosRow = unrecognized.find(r => r.abo_number === selectedLos) ?? null

  async function handleLink() {
    if (!selectedProfileId || !selectedLos || !selectedLosRow) return
    setLinking(true)
    setLinkError(null)
    try {
      await apiClient(`/api/admin/members/${selectedProfileId}/assign-abo`, {
        method: 'PATCH',
        body: JSON.stringify({
          abo_number: selectedLosRow.abo_number,
          sponsor_abo_number: selectedLosRow.sponsor_abo_number ?? null,
        }),
      })
      setUnrecognized(prev => prev.filter(r => r.abo_number !== selectedLos))
      setProfiles(prev => prev.filter(p => p.id !== selectedProfileId))
      setSelectedLos(null)
      setSelectedProfileId(null)
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : 'Link failed')
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="mt-6 p-5 rounded-2xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reconciliation</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('admin.data.reconciliation.desc')}</p>
        </div>
        {selectedLos && selectedProfileId && (
          <button onClick={handleLink} disabled={linking}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            {linking ? 'Linking...' : 'Link'}
          </button>
        )}
      </div>
      {linkError && <p className="text-xs mb-3" style={{ color: 'var(--brand-crimson)' }}>{linkError}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            Unrecognized in LOS — {unrecognized.length}
          </p>
          {unrecognized.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('admin.data.reconciliation.allMatched')}</p>
          ) : (
            <div className="space-y-1.5">
              {unrecognized.map(row => (
                <button key={row.abo_number}
                  onClick={() => setSelectedLos(s => s === row.abo_number ? null : row.abo_number)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors"
                  style={{
                    backgroundColor: selectedLos === row.abo_number ? 'rgba(62,119,133,0.15)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${selectedLos === row.abo_number ? '#3E7785' : 'transparent'}`,
                  }}>
                  <span className="font-mono font-medium block" style={{ color: 'var(--text-primary)' }}>{row.abo_number}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.name}</span>
                  {row.sponsor_abo_number && (
                    <span className="block mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>Sponsor {row.sponsor_abo_number}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            No ABO — awaiting position — {profiles.length}
          </p>
          {profiles.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('admin.data.reconciliation.noManualMembers')}</p>
          ) : (
            <div className="space-y-1.5">
              {profiles.map(p => (
                <button key={p.id}
                  onClick={() => setSelectedProfileId(s => s === p.id ? null : p.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors"
                  style={{
                    backgroundColor: selectedProfileId === p.id ? 'rgba(62,119,133,0.15)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${selectedProfileId === p.id ? '#3E7785' : 'transparent'}`,
                  }}>
                  <span className="font-medium block" style={{ color: 'var(--text-primary)' }}>{p.first_name} {p.last_name}</span>
                  {p.upline_abo_number && (
                    <span style={{ color: 'var(--text-secondary)' }}>Upline {p.upline_abo_number}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
