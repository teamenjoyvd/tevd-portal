'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { ReconciliationPanel } from './ReconciliationPanel'
import { useLosImport, type LOSStatus, type PurgeResult } from './useLosImport'
import type { AssemblyResult } from '@/lib/csv-import'
import { DropZone } from '@/components/los-import/DropZone'
import { AssemblySummary } from '@/components/los-import/AssemblySummary'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ── DiffSection ───────────────────────────────────────────────────────────────

function DiffSection({
  title, count, color, children,
}: { title: string; count: number; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(count <= 5)
  if (count === 0) return null
  return (
    <div className="mt-4">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full text-left">
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: color + '20', color }}>{count}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="ml-auto"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  )
}

// ── ScanPurgeButton ───────────────────────────────────────────────────────────

function ScanPurgeButton({
  assembly,
  losStatus,
  runScanPurge,
}: {
  assembly: AssemblyResult
  losStatus: LOSStatus | null
  runScanPurge: (keepAbos: string[]) => Promise<PurgeResult>
}) {
  const [purging, setPurging] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)

  const keepAbos = assembly.rows.map(r => r.abo_number).filter(Boolean)
  const currentCount = losStatus?.row_count ?? 0
  // Estimate only: the client does not have the DB ABO set, so we cannot compute
  // the exact intersection. The true removed count comes back from the server.
  // We show this as an upper bound to set expectations before the purge runs.
  const atRiskEstimate = currentCount > 0 ? currentCount : null

  async function handlePurge() {
    setPurging(true)
    setPurgeError(null)
    try {
      await runScanPurge(keepAbos)
    } catch (err: unknown) {
      setPurgeError(err instanceof Error ? err.message : 'Purge failed')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(var(--brand-crimson-rgb), 0.3)', backgroundColor: 'var(--status-alert-bg)' }}>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--status-alert-fg)' }}>Scan &amp; purge absent members</p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Permanently deletes all LOS members not present in the currently loaded files.
        Import your files first, then purge. Rollback is available immediately after.
        {atRiskEstimate !== null && (
          <span style={{ color: 'var(--status-alert-fg)' }}> Up to {atRiskEstimate} member{atRiskEstimate !== 1 ? 's' : ''} may be removed (exact count determined server-side).</span>
        )}
      </p>
      {purgeError && (
        <p className="text-xs mb-2" style={{ color: 'var(--status-alert-fg)' }}>{purgeError}</p>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            disabled={purging}
            className="border px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ borderColor: 'var(--brand-crimson)', color: 'var(--status-alert-fg)' }}
          >
            {purging ? 'Purging...' : 'Purge absent members'}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge absent members?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all LOS members not present in the currently loaded files.
              The exact number removed will be determined by the server.
              Make sure you have imported all files before purging.
              Rollback is available immediately after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurge} style={{ backgroundColor: 'var(--brand-crimson)' }}>
              Yes, purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── DataCenterTab ─────────────────────────────────────────────────────────────

export function DataCenterTab() {
  const { t } = useLanguage()
  const {
    fileRef,
    phase, setPhase,
    files,
    assembly,
    losStatus,
    importing, result, importError,
    purgeResult,
    rollingBack, rollbackError,
    purgingBack, purgeRollbackError,
    canReview,
    handleFileAdd, handleFileDrop, removeFile,
    handleImport, handleRollback, handlePurgeRollback,
    runScanPurge, resetForNewImport,
  } = useLosImport()

  // ── Phase: Assembly ───────────────────────────────────────────────────────
  if (phase === 'assembly') {
    return (
      <div className="space-y-6">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.data.title')}</p>

        {losStatus && (
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Current LOS: <strong style={{ color: 'var(--text-primary)' }}>{losStatus.row_count} members</strong>
            {losStatus.last_synced_at && (
              <> · last imported {new Date(losStatus.last_synced_at).toLocaleDateString()}</>
            )}
          </div>
        )}

        <DropZone
          fileRef={fileRef}
          files={files}
          onFileAdd={handleFileAdd}
          onFileDrop={handleFileDrop}
          removeFile={removeFile}
        />

        {assembly && <AssemblySummary assembly={assembly} sourceCount={files.length} />}

        {canReview && (
          <div className="flex flex-wrap gap-3 items-start">
            <button
              onClick={() => setPhase('diff')}
              className="bg-brand-crimson text-on-accent px-6 py-2 rounded-lg text-sm font-medium"
            >
              Review import ({assembly!.total_row_count} rows)
            </button>
          </div>
        )}

        {/* Scan & purge — shown when files are loaded, after the import CTA */}
        {assembly && assembly.total_row_count > 0 && (
          <ScanPurgeButton assembly={assembly} losStatus={losStatus} runScanPurge={runScanPurge} />
        )}

        {/* Purge result */}
        {purgeResult && (
          <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Purge complete — {purgeResult.removed} member{purgeResult.removed !== 1 ? 's' : ''} removed
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              Import ID: <span className="font-mono">{purgeResult.import_id}</span>
            </p>
            {purgeRollbackError && (
              <p className="text-xs mb-2" style={{ color: 'var(--status-alert-fg)' }}>{purgeRollbackError}</p>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={purgingBack}
                  className="border px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ borderColor: 'var(--brand-crimson)', color: 'var(--status-alert-fg)' }}
                >
                  {purgingBack ? 'Rolling back...' : 'Rollback purge'}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rollback purge?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restore all {purgeResult.removed} removed members to their state before the purge.
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handlePurgeRollback} style={{ backgroundColor: 'var(--brand-crimson)' }}>
                    Yes, rollback
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    )
  }

  // ── Phase: Diff ───────────────────────────────────────────────────────────
  if (phase === 'diff') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setPhase('assembly')}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            ← Back
          </button>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Import preview
          </p>
        </div>

        {losStatus && (
          <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Current LOS: <strong style={{ color: 'var(--text-primary)' }}>{losStatus.row_count} members</strong>
              {losStatus.last_synced_at && (
                <> · last imported {new Date(losStatus.last_synced_at).toLocaleDateString()}</>
              )}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              This import: <strong style={{ color: 'var(--text-primary)' }}>{assembly!.total_row_count} rows</strong>
              {' '}from <strong style={{ color: 'var(--text-primary)' }}>{files.length} file{files.length !== 1 ? 's' : ''}</strong>
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Upsert only — existing members are updated, new members are added. No members are deleted.
              Use Scan &amp; purge after import to remove absent members.
            </p>
          </div>
        )}

        {assembly!.conflicts.length > 0 && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(var(--brand-sienna-rgb), 0.08)', borderLeft: '3px solid var(--brand-sienna)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--status-pending-fg)' }}>
              {assembly!.conflicts.length} data discrepanc{assembly!.conflicts.length !== 1 ? 'ies' : 'y'} detected — first-seen file wins for each.
            </p>
          </div>
        )}

        {importError && (
          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--status-alert-bg)', borderColor: 'rgba(var(--brand-crimson-rgb), 0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--status-alert-fg)' }}>{importError}</p>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={importing}
          className="bg-brand-crimson text-on-accent px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {importing ? 'Importing...' : `Run import (${assembly!.total_row_count} rows)`}
        </button>
      </div>
    )
  }

  // ── Phase: Result ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={resetForNewImport}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          ← New import
        </button>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Import complete</p>
      </div>

      {result && (
        <div className="p-5 rounded-2xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>
              {result.diff.new_members.length} new
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-fg)' }}>
              {result.diff.level_changes.length} level changes
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending-fg)' }}>
              {result.diff.bonus_changes.length} bonus changes
            </span>
            {result.errors.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--status-alert-bg)', color: 'var(--status-alert-fg)' }}>
                {result.errors.length} errors
              </span>
            )}
          </div>

          {result.import_id && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Import ID: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{result.import_id}</span>
            </p>
          )}

          <DiffSection title="New members" count={result.diff.new_members.length} color="var(--status-success-fg)">
            {result.diff.new_members.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--status-success-bg)' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--status-success-fg)' }}>Level {m.abo_level}</span>
              </div>
            ))}
          </DiffSection>

          <DiffSection title={t('admin.data.result.levelChangesTitle')} count={result.diff.level_changes.length} color="var(--status-info-fg)">
            {result.diff.level_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--status-info-bg)' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>{m.prev_level} → {m.new_level}</span>
              </div>
            ))}
          </DiffSection>

          <DiffSection title={t('admin.data.result.bonusChangesTitle')} count={result.diff.bonus_changes.length} color="var(--status-pending-fg)">
            {result.diff.bonus_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--status-pending-bg)' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: m.new_bonus > m.prev_bonus ? 'var(--status-success-fg)' : 'var(--status-alert-fg)' }}>
                  {m.prev_bonus}% → {m.new_bonus}%
                </span>
              </div>
            ))}
          </DiffSection>

          {result.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--status-alert-fg)' }}>
                {t('admin.data.result.rowErrorsTitle').replace('{{count}}', String(result.errors.length))}
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs" style={{ color: 'var(--status-alert-fg)' }}>{e.abo_number}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import rollback */}
      {result?.import_id && (
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Rollback import</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            Restores LOS to the state before this import and re-anchors all affected portal members.
          </p>
          {rollbackError && (
            <p className="text-xs mb-2" style={{ color: 'var(--status-alert-fg)' }}>{rollbackError}</p>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={rollingBack}
                className="border px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ borderColor: 'var(--brand-crimson)', color: 'var(--status-alert-fg)' }}
              >
                {rollingBack ? 'Rolling back...' : 'Rollback this import'}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rollback import?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will revert all changes from this import.
                  Portal members will be re-anchored in the LOS tree.
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRollback}
                  style={{ backgroundColor: 'var(--brand-crimson)' }}
                >
                  Yes, rollback
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Scan & purge available after import */}
      {assembly && assembly.total_row_count > 0 && (
        <ScanPurgeButton assembly={assembly} losStatus={losStatus} runScanPurge={runScanPurge} />
      )}

      {/* Reconciliation */}
      {result && (result.unrecognized.length > 0 || result.manual_members_no_abo.length > 0) && (
        <ReconciliationPanel
          initialUnrecognized={result.unrecognized}
          initialProfiles={result.manual_members_no_abo}
        />
      )}
    </div>
  )
}
