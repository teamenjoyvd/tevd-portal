'use client'

// Shared assembly summary + junction panel. Consumes an AssemblyResult (from
// assembleFiles or mergeSubmissions) so admin and CORE surfaces render identically.

import { type AssemblyResult, type JunctionNode } from '@/lib/csv-import'

export function JunctionPanel({ junctions, ownerLabel = 'in' }: { junctions: JunctionNode[]; ownerLabel?: string }) {
  if (junctions.length === 0) return null
  return (
    <div className="p-4 rounded-container border mt-4" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
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
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded-control font-semibold"
              style={{
                backgroundColor: j.has_conflict ? 'rgba(224,122,95,0.2)' : 'rgba(129,178,154,0.2)',
                color: j.has_conflict ? '#e07a5f' : '#2d6a4f',
              }}>
              {j.has_conflict ? `data discrepancy: ${j.conflict_fields.join(', ')} · deepest owner wins` : 'clean'}
            </span>
            <span className="w-full text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {ownerLabel}: {j.files.join(', ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AssemblySummary({
  assembly,
  sourceCount,
  sourceLabel = 'file',
  ownerLabel = 'in',
}: {
  assembly: AssemblyResult
  sourceCount: number
  sourceLabel?: string
  ownerLabel?: string
}) {
  return (
    <>
      <div className="p-4 rounded-container border" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Assembly: {assembly.total_row_count} unique members from {sourceCount} {sourceLabel}{sourceCount !== 1 ? 's' : ''}
        </p>
        {assembly.disconnected_files.length > 0 && (
          <div className="mt-2 p-3 rounded-container" style={{ backgroundColor: 'rgba(224,122,95,0.08)' }}>
            <p className="text-xs font-semibold" style={{ color: '#e07a5f' }}>
              ⚠ Potentially disconnected {sourceLabel}{assembly.disconnected_files.length !== 1 ? 's' : ''}: {assembly.disconnected_files.join(', ')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              These share no ABO numbers with any other loaded {sourceLabel}. Verify they are part of the same tree.
            </p>
          </div>
        )}
      </div>
      <JunctionPanel junctions={assembly.junctions} ownerLabel={ownerLabel} />
    </>
  )
}
