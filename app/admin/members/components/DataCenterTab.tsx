'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { apiClient } from '@/lib/apiClient'
import { parseCSV, assembleFiles, type ImportResult, type AssemblyResult, type JunctionNode } from '@/lib/csv-import'
import { ReconciliationPanel } from './ReconciliationPanel'
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

// ── Types ─────────────────────────────────────────────────────────────────────

type FileEntry = { filename: string; rows: Record<string, string>[] }

type LOSStatus = {
  row_count: number
  last_synced_at: string | null
  last_import_id: string | null
  last_import: { id: string; imported_at: string; row_count: number; removed_count: number; status: string } | null
}

type PurgeResult = { removed: number; import_id: string }

type Phase = 'assembly' | 'diff' | 'result'

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

// ── JunctionPanel ─────────────────────────────────────────────────────────────

function JunctionPanel({ junctions }: { junctions: JunctionNode[] }) {
  if (junctions.length === 0) return null
  return (
    <div className="p-4 rounded-xl border mt-4" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Junction nodes ({junctions.length})
      </p>
      <div className="space-y-2">
        {junctions.map(j => (
          <div key={j.abo_number}
            className="flex flex-wrap items-start gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ backgroundColor: j.has_conflict ? 'rgba(224,122,95,0.08)' : 'rgba(129,178,154,0.08)' }}>
            <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{j.abo_number}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{j.name}</span>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                backgroundColor: j.has_conflict ? 'rgba(224,122,95,0.2)' : 'rgba(129,178,154,0.2)',
                color: j.has_conflict ? '#e07a5f' : '#2d6a4f',
              }}>
              {j.has_conflict ? `data discrepancy: ${j.conflict_fields.join(', ')} · first-seen wins` : 'clean'}
            </span>
            <span className="w-full text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              in: {j.files.join(', ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ScanPurgeButton ───────────────────────────────────────────────────────────

function ScanPurgeButton({
  assembly,
  losStatus,
  onPurgeComplete,
}: {
  assembly: AssemblyResult
  losStatus: LOSStatus | null
  onPurgeComplete: (result: PurgeResult) => void
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
      const data = await apiClient<PurgeResult>('/api/admin/los-scan', {
        method: 'POST',
        body: JSON.stringify({ keep_abos: keepAbos }),
      })
      onPurgeComplete(data)
    } catch (err: unknown) {
      setPurgeError(err instanceof Error ? err.message : 'Purge failed')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(188,71,73,0.3)', backgroundColor: 'rgba(188,71,73,0.04)' }}>
      <p className="text-sm font-semibold mb-1" style={{ color: '#bc4749' }}>Scan &amp; purge absent members</p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Permanently deletes all LOS members not present in the currently loaded files.
        Import your files first, then purge. Rollback is available immediately after.
        {atRiskEstimate !== null && (
          <span style={{ color: '#bc4749' }}> Up to {atRiskEstimate} member{atRiskEstimate !== 1 ? 's' : ''} may be removed (exact count determined server-side).</span>
        )}
      </p>
      {purgeError && (
        <p className="text-xs mb-2" style={{ color: '#bc4749' }}>{purgeError}</p>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            disabled={purging}
            className="border px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ borderColor: '#bc4749', color: '#bc4749' }}
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
            <AlertDialogAction onClick={handlePurge} style={{ backgroundColor: '#bc4749' }}>
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
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('assembly')

  const [files, setFiles] = useState<FileEntry[]>([])
  const [assembly, setAssembly] = useState<AssemblyResult | null>(null)

  const [losStatus, setLosStatus] = useState<LOSStatus | null>(null)

  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null)

  const [rollingBack, setRollingBack] = useState(false)
  const [rollbackError, setRollbackError] = useState<string | null>(null)

  const [purgingBack, setPurgingBack] = useState(false)
  const [purgeRollbackError, setPurgeRollbackError] = useState<string | null>(null)

  useEffect(() => {
    apiClient<LOSStatus>('/api/admin/los-import').then(setLosStatus).catch(() => null)
  }, [])

  useEffect(() => {
    if (files.length === 0) { setAssembly(null); return }
    setAssembly(assembleFiles(files))
  }, [files])

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const added = Array.from(e.target.files ?? [])
    if (added.length === 0) return
    if (fileRef.current) fileRef.current.value = ''

    const readers = added.map(file => new Promise<FileEntry>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = ev => {
        const text = (ev.target?.result as string).replace(/^\uFEFF/, '')
        const rows = parseCSV(text)
        resolve({ filename: file.name, rows })
      }
      reader.onerror = reject
      reader.readAsText(file)
    }))

    Promise.all(readers).then(newEntries => {
      setFiles(prev => {
        const existing = new Set(prev.map(f => f.filename))
        const unique = newEntries.filter(e => !existing.has(e.filename))
        return [...prev, ...unique]
      })
    }).catch(() => null)
  }

  function removeFile(filename: string) {
    setFiles(prev => prev.filter(f => f.filename !== filename))
  }

  async function handleImport() {
    if (!assembly) return
    setImporting(true)
    setImportError(null)
    setResult(null)
    try {
      const data = await apiClient<ImportResult>('/api/admin/los-import', {
        method: 'POST',
        body: JSON.stringify({ rows: assembly.rows }),
      })
      setResult(data)
      setPhase('result')
      apiClient<LOSStatus>('/api/admin/los-import').then(setLosStatus).catch(() => null)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setImporting(false)
    }
  }

  async function handleRollback() {
    if (!result?.import_id) return
    setRollingBack(true)
    setRollbackError(null)
    try {
      await apiClient('/api/admin/los-import/rollback', {
        method: 'POST',
        body: JSON.stringify({ import_id: result.import_id }),
      })
      setResult(null)
      setFiles([])
      setAssembly(null)
      setPhase('assembly')
      apiClient<LOSStatus>('/api/admin/los-import').then(setLosStatus).catch(() => null)
    } catch (err: unknown) {
      setRollbackError(err instanceof Error ? err.message : 'Rollback failed')
    } finally {
      setRollingBack(false)
    }
  }

  async function handlePurgeRollback() {
    if (!purgeResult?.import_id) return
    setPurgingBack(true)
    setPurgeRollbackError(null)
    try {
      await apiClient('/api/admin/los-import/rollback', {
        method: 'POST',
        body: JSON.stringify({ import_id: purgeResult.import_id }),
      })
      setPurgeResult(null)
      apiClient<LOSStatus>('/api/admin/los-import').then(setLosStatus).catch(() => null)
    } catch (err: unknown) {
      setPurgeRollbackError(err instanceof Error ? err.message : 'Rollback failed')
    } finally {
      setPurgingBack(false)
    }
  }

  // Import can proceed as long as there are rows — conflicts are warnings only
  const canReview = (assembly?.total_row_count ?? 0) > 0

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

        {/* Drop zone */}
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center"
          style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'))
            if (droppedFiles.length === 0) return
            const readers = droppedFiles.map(file => new Promise<FileEntry>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = ev => {
                const text = (ev.target?.result as string).replace(/^\uFEFF/, '')
                resolve({ filename: file.name, rows: parseCSV(text) })
              }
              reader.onerror = reject
              reader.readAsText(file)
            }))
            Promise.all(readers).then(newEntries => {
              setFiles(prev => {
                const existing = new Set(prev.map(f => f.filename))
                return [...prev, ...newEntries.filter(e => !existing.has(e.filename))]
              })
            }).catch(() => null)
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            multiple
            onChange={handleFileAdd}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {files.length === 0 ? 'Click or drag CSV files here' : 'Add more files'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>.csv only · multiple files supported</p>
          </label>
        </div>

        {/* File chips */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map(f => (
              <div
                key={f.filename}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border"
                style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
              >
                <span>{f.filename}</span>
                <span style={{ color: 'var(--text-secondary)' }}>({f.rows.length} rows)</span>
                <button
                  onClick={() => removeFile(f.filename)}
                  className="ml-1 rounded-full w-4 h-4 flex items-center justify-center hover:opacity-70"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Assembly status */}
        {assembly && (
          <>
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Assembly: {assembly.total_row_count} unique members from {files.length} file{files.length !== 1 ? 's' : ''}
              </p>
              {assembly.disconnected_files.length > 0 && (
                <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(224,122,95,0.08)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#e07a5f' }}>
                    ⚠ Potentially disconnected file{assembly.disconnected_files.length !== 1 ? 's' : ''}: {assembly.disconnected_files.join(', ')}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    These files share no ABO numbers with any other loaded file. Verify they are part of the same tree.
                  </p>
                </div>
              )}
            </div>
            <JunctionPanel junctions={assembly.junctions} />
          </>
        )}

        {canReview && (
          <div className="flex flex-wrap gap-3 items-start">
            <button
              onClick={() => setPhase('diff')}
              className="bg-[#bc4749] text-white px-6 py-2 rounded-lg text-sm font-medium"
            >
              Review import ({assembly!.total_row_count} rows)
            </button>
          </div>
        )}

        {/* Scan & purge — shown when files are loaded, after the import CTA */}
        {assembly && assembly.total_row_count > 0 && (
          <ScanPurgeButton
            assembly={assembly}
            losStatus={losStatus}
            onPurgeComplete={result => {
              setPurgeResult(result)
              apiClient<LOSStatus>('/api/admin/los-import').then(setLosStatus).catch(() => null)
            }}
          />
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
              <p className="text-xs mb-2" style={{ color: '#bc4749' }}>{purgeRollbackError}</p>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={purgingBack}
                  className="border px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ borderColor: '#bc4749', color: '#bc4749' }}
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
                  <AlertDialogAction onClick={handlePurgeRollback} style={{ backgroundColor: '#bc4749' }}>
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
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(224,122,95,0.08)', borderLeft: '3px solid #e07a5f' }}>
            <p className="text-xs font-semibold" style={{ color: '#e07a5f' }}>
              {assembly!.conflicts.length} data discrepanc{assembly!.conflicts.length !== 1 ? 'ies' : 'y'} detected — first-seen file wins for each.
            </p>
          </div>
        )}

        {importError && (
          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgba(188,71,73,0.06)', borderColor: 'rgba(188,71,73,0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{importError}</p>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={importing}
          className="bg-[#bc4749] text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
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
          onClick={() => { setPhase('assembly'); setFiles([]); setAssembly(null); setResult(null); setPurgeResult(null) }}
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
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#81b29a20', color: '#2d6a4f' }}>
              {result.diff.new_members.length} new
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#3d405b20', color: '#3d405b' }}>
              {result.diff.level_changes.length} level changes
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e07a5f20', color: '#e07a5f' }}>
              {result.diff.bonus_changes.length} bonus changes
            </span>
            {result.errors.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(188,71,73,0.12)', color: '#bc4749' }}>
                {result.errors.length} errors
              </span>
            )}
          </div>

          {result.import_id && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Import ID: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{result.import_id}</span>
            </p>
          )}

          <DiffSection title="New members" count={result.diff.new_members.length} color="#81b29a">
            {result.diff.new_members.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#81b29a10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: '#2d6a4f' }}>Level {m.abo_level}</span>
              </div>
            ))}
          </DiffSection>

          <DiffSection title={t('admin.data.result.levelChangesTitle')} count={result.diff.level_changes.length} color="#3d405b">
            {result.diff.level_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#3d405b10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>{m.prev_level} → {m.new_level}</span>
              </div>
            ))}
          </DiffSection>

          <DiffSection title={t('admin.data.result.bonusChangesTitle')} count={result.diff.bonus_changes.length} color="#e07a5f">
            {result.diff.bonus_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#e07a5f10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: m.new_bonus > m.prev_bonus ? '#2d6a4f' : '#bc4749' }}>
                  {m.prev_bonus}% → {m.new_bonus}%
                </span>
              </div>
            ))}
          </DiffSection>

          {result.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-crimson)' }}>
                {t('admin.data.result.rowErrorsTitle').replace('{{count}}', String(result.errors.length))}
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{e.abo_number}: {e.error}</p>
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
            <p className="text-xs mb-2" style={{ color: 'var(--brand-crimson)' }}>{rollbackError}</p>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={rollingBack}
                className="border px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ borderColor: '#bc4749', color: '#bc4749' }}
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
                  style={{ backgroundColor: '#bc4749' }}
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
        <ScanPurgeButton
          assembly={assembly}
          losStatus={losStatus}
          onPurgeComplete={result => {
            setPurgeResult(result)
            apiClient<LOSStatus>('/api/admin/los-import').then(setLosStatus).catch(() => null)
          }}
        />
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
