import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/apiClient'
import { type ImportResult } from '@/lib/csv-import'
import { useAssembly, type FileEntry } from '@/components/los-import/useAssembly'

export type { FileEntry }

export type LOSStatus = {
  row_count: number
  last_synced_at: string | null
  last_import_id: string | null
  last_import: { id: string; imported_at: string; row_count: number; removed_count: number; status: string } | null
}

export type PurgeResult = { removed: number; import_id: string }

export type Phase = 'assembly' | 'diff' | 'result'

export function useLosImport() {
  const { fileRef, files, assembly, handleFileAdd, handleFileDrop, removeFile, reset: resetAssembly } = useAssembly()

  const [phase, setPhase] = useState<Phase>('assembly')

  const [losStatus, setLosStatus] = useState<LOSStatus | null>(null)

  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null)

  const [rollingBack, setRollingBack] = useState(false)
  const [rollbackError, setRollbackError] = useState<string | null>(null)

  const [purgingBack, setPurgingBack] = useState(false)
  const [purgeRollbackError, setPurgeRollbackError] = useState<string | null>(null)

  function refreshLosStatus() {
    apiClient<LOSStatus>('/api/admin/los-import').then(setLosStatus).catch(() => null)
  }

  useEffect(() => {
    refreshLosStatus()
  }, [])

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
      refreshLosStatus()
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
      resetAssembly()
      setPhase('assembly')
      refreshLosStatus()
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
      refreshLosStatus()
    } catch (err: unknown) {
      setPurgeRollbackError(err instanceof Error ? err.message : 'Rollback failed')
    } finally {
      setPurgingBack(false)
    }
  }

  function onPurgeComplete(purgeRes: PurgeResult) {
    setPurgeResult(purgeRes)
    refreshLosStatus()
  }

  async function runScanPurge(keepAbos: string[]): Promise<PurgeResult> {
    const data = await apiClient<PurgeResult>('/api/admin/los-scan', {
      method: 'POST',
      body: JSON.stringify({ keep_abos: keepAbos }),
    })
    onPurgeComplete(data)
    return data
  }

  function resetForNewImport() {
    setPhase('assembly')
    resetAssembly()
    setResult(null)
    setPurgeResult(null)
  }

  // Import can proceed as long as there are rows — conflicts are warnings only
  const canReview = (assembly?.total_row_count ?? 0) > 0

  return {
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
    onPurgeComplete, runScanPurge, resetForNewImport,
  }
}
