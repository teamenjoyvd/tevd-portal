'use client'

import { Drawer } from '@/components/ui/drawer'
import { LinkForm } from './LinkForm'
import type { LinkFormData } from './LinkForm'

export function LinkEditDrawer({
  open,
  onClose,
  title,
  initial,
  onSave,
  isPending,
  submitLabel,
}: {
  open: boolean
  onClose: () => void
  title: string
  initial: LinkFormData
  onSave: (data: LinkFormData) => void
  isPending: boolean
  submitLabel: string
}) {
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <LinkForm initial={initial} onSave={onSave} isPending={isPending} submitLabel={submitLabel} />
    </Drawer>
  )
}
