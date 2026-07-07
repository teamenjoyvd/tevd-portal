'use client'

import { VaulDrawer } from '@/components/ui/vaul-drawer'

// Vaul slides the sheet in via a JS-driven transform/transition on mount; a
// static capture taken mid-transition shows the sheet still translated below
// the fold. This scopes transitions off for the preview only — it doesn't
// touch the shipped component.
function NoTransition() {
  return <style>{'[data-vaul-drawer]{transition:none!important;transform:none!important}'}</style>
}

export function Open() {
  return (
    <>
      <NoTransition />
      <VaulDrawer open onClose={() => {}}>
        <div style={{ padding: '0 24px 24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Trip options
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Choose how you&apos;d like to share this itinerary with your group.
          </p>
        </div>
      </VaulDrawer>
    </>
  )
}
