'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

// Sonner animates each toast in via CSS transition/transform; a static
// capture taken mid-transition shows nothing. This scopes transitions off
// for the preview only — it doesn't touch the shipped component.
function NoTransition() {
  return <style>{'[data-sonner-toaster] *{transition:none!important;animation:none!important}'}</style>
}

// The toast list is position:fixed, so it contributes zero height to the
// document flow — the capture harness screenshots the page's scrollable
// height, which collapses to ~0 without this. Fixed-position content still
// paints relative to the real viewport regardless of this div's own height.
function ViewportFiller() {
  return <div style={{ minHeight: '100vh' }} />
}

export function Default() {
  useEffect(() => {
    toast('Trip itinerary updated', { description: 'Changes saved and travelers notified.', duration: Infinity })
  }, [])
  return (
    <>
      <NoTransition />
      <ViewportFiller />
      <Toaster />
    </>
  )
}

export function ErrorToast() {
  useEffect(() => {
    toast.error('Payment failed', { description: 'Card was declined — try another method.', duration: Infinity })
  }, [])
  return (
    <>
      <NoTransition />
      <ViewportFiller />
      <Toaster />
    </>
  )
}
