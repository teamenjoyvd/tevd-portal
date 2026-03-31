import type { Dispatch, SetStateAction } from 'react'

export function makeDragHandlers<T extends { id: string }>(
  dragging: string | null,
  setDragging: (id: string | null) => void,
  local: T[],
  setLocal: Dispatch<SetStateAction<T[]>>,
  onDrop: (items: { id: string; sort_order: number }[]) => void,
) {
  return {
    onDragStart: (id: string) => setDragging(id),
    onDragOver: (e: React.DragEvent, targetId: string) => {
      e.preventDefault()
      if (!dragging || dragging === targetId) return
      setLocal(prev => {
        const from = prev.findIndex(x => x.id === dragging)
        const to   = prev.findIndex(x => x.id === targetId)
        if (from === -1 || to === -1) return prev
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      })
    },
    onDrop: () => {
      setDragging(null)
      onDrop(local.map((item, i) => ({ id: item.id, sort_order: i * 10 })))
    },
    onDragEnd: () => setDragging(null),
    isDragging: (id: string) => dragging === id,
  }
}
