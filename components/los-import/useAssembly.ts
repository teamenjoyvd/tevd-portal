'use client'

// Shared CSV assembly state — the source-agnostic core extracted from the admin
// useLosImport hook so both the admin Data Center and the CORE upload page drive
// one assembly engine. Holds only files + assembled result and the file handlers;
// import/purge/rollback stay in the admin-only useLosImport.

import { useState, useRef, useMemo } from 'react'
import { parseCSV, assembleFiles, type AssemblyResult } from '@/lib/csv-import'

export type FileEntry = { filename: string; rows: Record<string, string>[] }

export function readCsvFiles(fileList: File[]): Promise<FileEntry[]> {
  const readers = fileList.map(file => new Promise<FileEntry>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = ev => {
      const text = (ev.target?.result as string).replace(/^﻿/, '')
      resolve({ filename: file.name, rows: parseCSV(text) })
    }
    reader.onerror = reject
    reader.readAsText(file)
  }))
  return Promise.all(readers)
}

export function useAssembly() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const assembly: AssemblyResult | null = useMemo(
    () => (files.length === 0 ? null : assembleFiles(files)),
    [files],
  )

  function addFiles(newEntries: FileEntry[]) {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.filename))
      return [...prev, ...newEntries.filter(e => !existing.has(e.filename))]
    })
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const added = Array.from(e.target.files ?? [])
    if (added.length === 0) return
    if (fileRef.current) fileRef.current.value = ''
    readCsvFiles(added).then(addFiles).catch(() => null)
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'))
    if (droppedFiles.length === 0) return
    readCsvFiles(droppedFiles).then(addFiles).catch(() => null)
  }

  function removeFile(filename: string) {
    setFiles(prev => prev.filter(f => f.filename !== filename))
  }

  function reset() {
    setFiles([])
  }

  return { fileRef, files, assembly, handleFileAdd, handleFileDrop, removeFile, reset }
}
