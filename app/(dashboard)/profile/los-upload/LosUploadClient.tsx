'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { checkSubmissionRoot } from '@/lib/csv-import'
import { useAssembly } from '@/components/los-import/useAssembly'
import { DropZone } from '@/components/los-import/DropZone'
import { AssemblySummary } from '@/components/los-import/AssemblySummary'
import { SubtreePreview, type ChangeStatus, type NodeMeta } from '@/components/los-import/SubtreePreview'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Submission = {
  id: string
  root_abo_number: string
  row_count: number
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
}

type TreeNode = {
  abo_number: string | null
  abo_level: string | null
  bonus_percent: number | null
  last_synced_at: string | null
  last_updated_by_abo: string | null
}

const STATUS_STYLE: Record<Submission['status'], { bg: string; color: string; label: string }> = {
  pending:   { bg: '#f2cc8f33', color: '#7a5c00', label: 'Pending admin review' },
  approved:  { bg: '#1a3c2e18', color: '#1a3c2e', label: 'Approved & imported' },
  rejected:  { bg: '#bc474915', color: '#bc4749', label: 'Rejected' },
  withdrawn: { bg: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', label: 'Withdrawn' },
}

const ROOT_ERROR: Record<string, string> = {
  'no-root': 'This file has no single tree root (it may be cyclic). Export your full downline and try again.',
  'multi-root': 'This file has more than one top node. Upload only your own connected sub-tree.',
  'mismatch': 'The top of this tree does not match your ABO number — you can only upload your own part.',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const HOWTO_OPEN_STORAGE_KEY = 'tevd-los-howto-open'

export function LosUploadClient({ aboNumber }: { aboNumber: string | null }) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const { fileRef, files, assembly, handleFileAdd, handleFileDrop, removeFile, reset } = useAssembly()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [howToOpen, setHowToOpen] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(HOWTO_OPEN_STORAGE_KEY)
    if (stored === 'false') setHowToOpen(false)
  }, [])

  function handleHowToToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = e.currentTarget.open
    setHowToOpen(isOpen)
    localStorage.setItem(HOWTO_OPEN_STORAGE_KEY, String(isOpen))
  }

  const { data: submissionsData } = useQuery<{ submissions: Submission[]; abo_number: string | null }>({
    queryKey: ['my-los-submissions'],
    queryFn: () => apiClient('/api/profile/los-submission'),
  })

  // Current subtree — used to tint the preview by what changes.
  const { data: treeData } = useQuery<{ nodes: TreeNode[] }>({
    queryKey: ['my-los-tree'],
    queryFn: () => apiClient('/api/los/tree'),
  })

  const existingByAbo = useMemo(() => {
    const m = new Map<string, TreeNode>()
    for (const n of treeData?.nodes ?? []) if (n.abo_number) m.set(n.abo_number, n)
    return m
  }, [treeData])

  const rootCheck = assembly && aboNumber ? checkSubmissionRoot(assembly.rows, aboNumber) : null

  const changeStatus = useMemo(() => {
    const map: Record<string, ChangeStatus> = {}
    for (const r of assembly?.rows ?? []) {
      const abo = r.abo_number
      if (!abo) continue
      const prev = existingByAbo.get(abo)
      if (!prev) { map[abo] = 'new'; continue }
      if ((prev.abo_level ?? '') !== (r.abo_level ?? '')) { map[abo] = 'level'; continue }
      const newBonus = r.bonus_percent ? Number(r.bonus_percent) : 0
      if (Math.abs(newBonus - (prev.bonus_percent ?? 0)) >= 3) { map[abo] = 'bonus'; continue }
      map[abo] = 'unchanged'
    }
    return map
  }, [assembly, existingByAbo])

  // Persisted last-updated info per node — flags rows an upline last touched.
  const meta = useMemo(() => {
    const map: Record<string, NodeMeta> = {}
    for (const [abo, n] of existingByAbo.entries()) {
      map[abo] = {
        lastUpdated: n.last_synced_at,
        byUpline: !!n.last_updated_by_abo && n.last_updated_by_abo !== abo,
      }
    }
    return map
  }, [existingByAbo])

  async function handleSubmit() {
    if (!assembly || !rootCheck?.ok) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await apiClient('/api/profile/los-submission', {
        method: 'POST',
        body: JSON.stringify({ rows: assembly.rows }),
      })
      reset()
      qc.invalidateQueries({ queryKey: ['my-los-submissions'] })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWithdraw(id: string) {
    setWithdrawError(null)
    try {
      await apiClient('/api/profile/los-submission', { method: 'PATCH', body: JSON.stringify({ id }) })
    } catch (err: unknown) {
      // A withdraw can lose a race (already approved/rejected) — say so, and still
      // refresh so the list shows the status that actually won.
      setWithdrawError(err instanceof Error ? err.message : 'Withdraw failed')
    } finally {
      qc.invalidateQueries({ queryKey: ['my-los-submissions'] })
    }
  }

  const submissions = submissionsData?.submissions ?? []

  if (!aboNumber) {
    return (
      <div className="py-8 max-w-[900px] mx-auto px-4 sm:px-6">
        <h1 className="font-display text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Upload your LOS</h1>
        <div className="rounded-xl border px-5 py-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            You need a verified ABO number before you can upload your part of the LOS. Verify your ABO in your profile first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 pb-16 max-w-[900px] mx-auto px-4 sm:px-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Upload your LOS</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Upload the CSV export of your own downline (rooted at your ABO <span className="font-mono">{aboNumber}</span>).
          It will be sent to an admin for review before it goes live.
        </p>
      </div>

      <details className="rounded-xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }} open={howToOpen} onToggle={handleHowToToggle}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('los.upload.howToTitle')}
        </summary>
        <div className="px-4 pb-4 text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>
              {t('los.upload.step1Pre')}
              <a href="https://www.amway.bg/business-centre/los-map" target="_blank" rel="noopener noreferrer" className="underline">
                amway.bg/business-centre/los-map
              </a>
              {t('los.upload.step1Post')}
            </li>
            <li>{t('los.upload.step2Pre')}<strong>{t('los.upload.step2Bold')}</strong>{t('los.upload.step2Post')}</li>
            <li>{t('los.upload.step3Pre')}<strong>{t('los.upload.step3Bold')}</strong>{t('los.upload.step3Mid')}<strong>{t('los.upload.step3Bold2')}</strong>{t('los.upload.step3Post')}</li>
            <li>{t('los.upload.step4Pre')}<strong>{t('los.upload.step4Bold')}</strong>{t('los.upload.step4Post')}</li>
            <li>{t('los.upload.step5Pre')}<strong>{t('los.upload.step5Bold')}</strong>{t('los.upload.step5Post')}</li>
          </ol>
          <p className="text-xs pt-1">
            {t('los.upload.rootNotePre')}<span className="font-mono">{aboNumber}</span>{t('los.upload.rootNotePost')}
          </p>
        </div>
      </details>

      <DropZone
        fileRef={fileRef}
        files={files}
        onFileAdd={handleFileAdd}
        onFileDrop={handleFileDrop}
        removeFile={removeFile}
      />

      {assembly && (
        <>
          <AssemblySummary assembly={assembly} sourceCount={files.length} />

          {rootCheck && !rootCheck.ok && (
            <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgba(188,71,73,0.06)', borderColor: 'rgba(188,71,73,0.3)' }}>
              <p className="text-sm" style={{ color: '#bc4749' }}>{ROOT_ERROR[rootCheck.reason]}</p>
              {rootCheck.reason === 'mismatch' && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Found root: <span className="font-mono">{rootCheck.roots[0]}</span> · your ABO: <span className="font-mono">{aboNumber}</span>
                </p>
              )}
            </div>
          )}

          {rootCheck?.ok && (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Preview — what your upload changes</p>
              <SubtreePreview rows={assembly.rows} anchorAbo={aboNumber} changeStatus={changeStatus} meta={meta} />
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                Tinted by change: <span style={{ color: '#2d6a4f' }}>new</span> · <span style={{ color: '#3d405b' }}>level</span> · <span style={{ color: '#e07a5f' }}>bonus</span>.
                “upd · upline” (orange) marks members an upline last updated.
              </p>
            </div>
          )}

          {submitError && <p className="text-sm" style={{ color: '#bc4749' }}>{submitError}</p>}

          <button
            onClick={handleSubmit}
            disabled={!rootCheck?.ok || submitting}
            className="bg-[#bc4749] text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : `Submit for review (${assembly.total_row_count} members)`}
          </button>
        </>
      )}

      {/* My submissions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>My submissions</p>
        {withdrawError && <p className="text-sm" style={{ color: '#bc4749' }}>{withdrawError}</p>}
        {submissions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No submissions yet.</p>
        ) : (
          submissions.map(sub => {
            const s = STATUS_STYLE[sub.status]
            return (
              <div key={sub.id} className="rounded-xl border px-4 py-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{sub.row_count} members</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>{fmtDate(sub.created_at)}</span>
                  {sub.status === 'pending' && (
                    <button onClick={() => handleWithdraw(sub.id)} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                      Withdraw
                    </button>
                  )}
                </div>
                {sub.admin_note && <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>Note: {sub.admin_note}</p>}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
