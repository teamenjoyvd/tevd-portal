'use client'

import { useCallback } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableBento, DragHandle } from './SortableBento'

// Desktop-only: this is the sole module importing @dnd-kit/*, dynamically
// loaded by ProfileClient.tsx (next/dynamic, ssr:false) so mobile never
// pulls this chunk in.

type BentoEntry = { colSpan: number; minHeight: number; node: React.ReactNode }

function SortableBentoItem({
  id,
  entry,
  collapsed,
  onToggleCollapse,
}: {
  id: string
  entry: BentoEntry
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <SortableBento
      id={id}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      colSpan={entry.colSpan}
      minHeight={entry.minHeight}
      cardRef={setNodeRef}
      dragStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      dragHandle={<DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />}
    >
      {entry.node}
    </SortableBento>
  )
}

export default function BentoGrid({
  orderedBentos,
  bentoOrder,
  bentoCollapsed,
  onToggleCollapse,
  onReorder,
}: {
  orderedBentos: { id: string; entry: BentoEntry }[]
  bentoOrder: string[]
  bentoCollapsed: Record<string, boolean>
  onToggleCollapse: (id: string) => void
  onReorder: (next: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = bentoOrder.indexOf(active.id as string)
    const newIndex = bentoOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(bentoOrder, oldIndex, newIndex))
  }, [bentoOrder, onReorder])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedBentos.map(b => b.id)} strategy={rectSortingStrategy}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px' }}>
          {orderedBentos.map(({ id, entry }) => (
            <SortableBentoItem
              key={id}
              id={id}
              entry={entry}
              collapsed={!!bentoCollapsed[id]}
              onToggleCollapse={() => onToggleCollapse(id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
