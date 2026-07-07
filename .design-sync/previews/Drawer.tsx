'use client'

import { Drawer } from '@/components/ui/drawer'

export function Open() {
  return (
    <Drawer open onClose={() => {}} title="Edit guide">
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Update the guide details below. Changes are saved automatically as
        travelers view this guide.
      </p>
    </Drawer>
  )
}
