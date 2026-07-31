'use client'

import { useCallback } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableBento, DragHandle } from './SortableBento'

// Desktop-only: this is the sole module importing @dnd-kit/*, dynamically
// loaded by ProfileClient.tsx (next/dynamic, ssr:false) so mobile never
// pulls this chunk in.

type BentoEntry = { colSpan: number; minHeight: number; node: React.ReactNode; cardStyle?: React.CSSProperties }

function SortableBentoItem({
  id,
  entry,
  collapsed,
  onToggleCollapse,
  controlsDisabled,
}: {
  id: string
  entry: BentoEntry
  collapsed: boolean
  onToggleCollapse: () => void
  controlsDisabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    // dnd-kit's own gate: stops the sensor activating at all before the saved
    // layout is restored. Hiding the handle alone would still leave the item
    // draggable by other means.
  } = useSortable({ id, disabled: controlsDisabled })

  return (
    <SortableBento
      id={id}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      controlsDisabled={controlsDisabled}
      colSpan={entry.colSpan}
      minHeight={entry.minHeight}
      cardRef={setNodeRef}
      dragStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      dragHandle={<DragHandle ref={setActivatorNodeRef} {...attributes} {...listeners} />}
      cardStyle={entry.cardStyle}
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
  controlsDisabled,
}: {
  orderedBentos: { id: string; entry: BentoEntry }[]
  bentoOrder: string[]
  bentoCollapsed: Record<string, boolean>
  onToggleCollapse: (id: string) => void
  onReorder: (next: string[]) => void
  controlsDisabled?: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = bentoOrder.indexOf(active.id as string)
    const newIndex = bentoOrder.indexOf(over.id as string)
    onReorder(arrayMove(bentoOrder, oldIndex, newIndex))
  }, [bentoOrder, onReorder])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedBentos.map(b => b.id)} strategy={rectSortingStrategy}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 'var(--bento-gap)' }}>
          {orderedBentos.map(({ id, entry }) => (
            <SortableBentoItem
              key={id}
              id={id}
              entry={entry}
              collapsed={!!bentoCollapsed[id]}
              onToggleCollapse={() => onToggleCollapse(id)}
              controlsDisabled={controlsDisabled}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
