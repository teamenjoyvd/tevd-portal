'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { Block } from './guide-types'

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: Block[]
  onChange: (b: Block[]) => void
}): React.JSX.Element {
  const { t } = useLanguage()
  const safeBlocks = Array.isArray(blocks) ? blocks : []
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  function addBlock(type: Block['type']) {
    onChange([...safeBlocks, { type, content: { en: '', bg: '' }, emoji: type === 'callout' ? '💡' : undefined }])
  }
  function updateBlock(i: number, partial: Partial<Block>) {
    onChange(safeBlocks.map((b, idx) => idx === i ? { ...b, ...partial } : b))
  }
  function updateContent(i: number, lang: 'en' | 'bg', value: string) {
    updateBlock(i, { content: { ...safeBlocks[i].content, [lang]: value } })
  }
  function removeBlock(i: number) {
    onChange(safeBlocks.filter((_, idx) => idx !== i))
    setCollapsed(prev => {
      const next: Record<number, boolean> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k)
        if (ki < i) next[ki] = v
        else if (ki > i) next[ki - 1] = v
      })
      return next
    })
  }
  function toggleCollapse(i: number) {
    setCollapsed(prev => ({ ...prev, [i]: !prev[i] }))
  }

  // Drag-to-reorder handlers (index-based — blocks have no stable id)
  function handleDragStart(i: number) {
    setDraggingIdx(i)
  }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (draggingIdx === null || draggingIdx === i) return
    setDragOverIdx(i)
  }
  function handleDrop(targetIdx: number) {
    if (draggingIdx === null || draggingIdx === targetIdx) {
      setDraggingIdx(null)
      setDragOverIdx(null)
      return
    }
    const next = [...safeBlocks]
    const [moved] = next.splice(draggingIdx, 1)
    next.splice(targetIdx, 0, moved)
    onChange(next)
    setDraggingIdx(null)
    setDragOverIdx(null)
  }
  function handleDragEnd() {
    setDraggingIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Block count indicator */}
      {safeBlocks.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {safeBlocks.length} block{safeBlocks.length !== 1 ? 's' : ''}
        </p>
      )}

      {safeBlocks.map((block, i) => {
        const isCollapsed = !!collapsed[i]
        const isDragging = draggingIdx === i
        const isDragOver = dragOverIdx === i
        const previewText = block.content.en.slice(0, 60) || '—'

        return (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={handleDragEnd}
            className="rounded-xl border transition-opacity"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: isDragOver ? 'var(--brand-crimson)' : 'var(--border-default)',
              opacity: isDragging ? 0.4 : 1,
              cursor: 'grab',
            }}
          >
            {/* Block header — always visible */}
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                {/* Drag grip */}
                <span
                  className="flex-shrink-0 cursor-grab select-none"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-hidden
                >
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                    <circle cx="4" cy="3" r="1.5"/>
                    <circle cx="8" cy="3" r="1.5"/>
                    <circle cx="4" cy="8" r="1.5"/>
                    <circle cx="8" cy="8" r="1.5"/>
                    <circle cx="4" cy="13" r="1.5"/>
                    <circle cx="8" cy="13" r="1.5"/>
                  </svg>
                </span>

                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest flex-shrink-0"
                  style={{
                    backgroundColor:
                      block.type === 'heading' ? 'var(--brand-forest)'
                        : block.type === 'callout' ? 'var(--brand-teal)'
                        : 'rgba(0,0,0,0.06)',
                    color: block.type === 'paragraph' ? 'var(--text-secondary)' : 'var(--brand-parchment)',
                  }}
                >
                  {block.type}
                </span>

                {block.type === 'callout' && !isCollapsed && (
                  <input
                    value={block.emoji ?? ''}
                    onChange={e => updateBlock(i, { emoji: e.target.value })}
                    placeholder="emoji"
                    aria-label={`Callout emoji for block ${i + 1}`}
                    className="w-14 border rounded-lg px-2 py-1 text-sm text-center flex-shrink-0"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  />
                )}

                {isCollapsed && (
                  <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {previewText}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleCollapse(i)}
                  aria-label={isCollapsed ? `Expand block ${i + 1}` : `Collapse block ${i + 1}`}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-xs transition-transform"
                  style={{ color: 'var(--text-secondary)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <button
                  onClick={() => removeBlock(i)}
                  aria-label={`Remove block ${i + 1}`}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-xs"
                  style={{ color: 'var(--brand-crimson)' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Block content — hidden when collapsed */}
            {!isCollapsed && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  {(['en', 'bg'] as const).map(lang => (
                    <div key={lang}>
                      <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block"
                        style={{ color: 'var(--text-secondary)' }}>{lang.toUpperCase()}</label>
                      {block.type === 'paragraph' || block.type === 'callout' ? (
                        <>
                          <textarea
                            value={block.content[lang]}
                            onChange={e => updateContent(i, lang, e.target.value)}
                            rows={5}
                            className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                          />
                          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                            {t('admin.content.guides.markdownHint')}
                          </p>
                        </>
                      ) : (
                        <input
                          value={block.content[lang]}
                          onChange={e => updateContent(i, lang, e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-sm"
                          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add block controls — always at bottom */}
      <div className="flex gap-2 pt-1 sticky bottom-0 pb-2">
        {(['heading', 'paragraph', 'callout'] as const).map(type => (
          <button
            key={type}
            onClick={() => addBlock(type)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)' }}
          >
            + {type}
          </button>
        ))}
      </div>
    </div>
  )
}
