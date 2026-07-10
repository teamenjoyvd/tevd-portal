'use client'

import { useRef, useMemo } from 'react'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import type { JSONContent } from '@tiptap/core'
import { useTiptapCopyButtons } from '@/lib/hooks/useTiptapCopyButtons'

const TIPTAP_EXTENSIONS = [StarterKit, TiptapLink, Image]

// Renders trip.description (JSONContent) as rich HTML via generateHTML.
// Split into its own file, dynamically imported with ssr:false from
// shared.tsx, so @tiptap/* is not in the initial bundle for every
// trip-detail view (only TripDetail's description block needs it).
export default function TripDescription({ description }: { description: JSONContent | null }) {
  const outputRef = useRef<HTMLDivElement>(null)
  const html = useMemo(
    () => (description ? generateHTML(description, TIPTAP_EXTENSIONS) : null),
    [description],
  )

  useTiptapCopyButtons(outputRef, [html])

  if (!html) return null
  return (
    <div
      ref={outputRef}
      className="tiptap-output mb-5"
      // Content is generated from admin-controlled JSONContent — no user-submitted HTML.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
