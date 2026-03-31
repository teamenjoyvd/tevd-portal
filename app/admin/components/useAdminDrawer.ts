import { useState } from 'react'

export type AdminDrawer<T> = {
  open: boolean
  editing: T | null
  isCreating: boolean
  isEditing: boolean
  openCreate: () => void
  openEdit: (item: T) => void
  close: () => void
}

export function useAdminDrawer<T>(): AdminDrawer<T> {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)

  return {
    open,
    editing,
    isCreating: open && editing === null,
    isEditing: open && editing !== null,
    openCreate: () => { setEditing(null); setOpen(true) },
    openEdit: (item: T) => { setEditing(item); setOpen(true) },
    close: () => { setOpen(false); setEditing(null) },
  }
}
