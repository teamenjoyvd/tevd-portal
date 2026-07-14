'use client'

// Shared CSV drop zone + file chips. Presentational — state lives in useAssembly.

import type { FileEntry } from './useAssembly'

export function DropZone({
  fileRef,
  files,
  onFileAdd,
  onFileDrop,
  removeFile,
  idPrefix = 'csv-upload',
}: {
  fileRef: React.RefObject<HTMLInputElement | null>
  files: FileEntry[]
  onFileAdd: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileDrop: (e: React.DragEvent<HTMLDivElement>) => void
  removeFile: (filename: string) => void
  idPrefix?: string
}) {
  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center"
        style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}
        onDragOver={e => e.preventDefault()}
        onDrop={onFileDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          multiple
          onChange={onFileAdd}
          className="hidden"
          id={idPrefix}
        />
        <label htmlFor={idPrefix} className="cursor-pointer">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {files.length === 0 ? 'Click or drag CSV files here' : 'Add more files'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>.csv only · multiple files supported</p>
        </label>
      </div>

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
                aria-label={`Remove ${f.filename}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
