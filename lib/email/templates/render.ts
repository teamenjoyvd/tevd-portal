import { render } from '@react-email/render'
import type * as React from 'react'

/**
 * Renders a React Email component to an HTML string.
 * Must be called server-side only (Node.js / Edge runtime).
 */
export async function renderEmailTemplate(element: React.ReactElement): Promise<string> {
  return render(element)
}
