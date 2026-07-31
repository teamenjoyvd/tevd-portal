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
    /**
     * Touch reorder. HTML5 dragstart/dragover never fire on touch, so the grip
     * above is desktop-only and mobile moves rows one step at a time.
     * Computes the next array itself and persists that — deliberately NOT
     * reusing onDrop() above, which maps `local` as captured at render time.
     */
    moveBy: (id: string, delta: number) => {
      const from = local.findIndex(x => x.id === id)
      if (from === -1) return
      const to = from + delta
      if (to < 0 || to >= local.length) return
      const next = [...local]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      setLocal(next)
      onDrop(next.map((item, i) => ({ id: item.id, sort_order: i * 10 })))
    },
  }
}
