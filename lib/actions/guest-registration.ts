'use server'

import { z } from 'zod'
import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import * as React from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailTemplate } from '@/lib/email/templates/render'
import { GuestEventMagicLinkEmail } from '@/lib/email/templates/GuestEventMagicLinkEmail'

// -- Types --------------------------------------------------------------------

export type RegisterGuestState = { success: boolean; error?: string }

// -- Schema -------------------------------------------------------------------

const schema = z.object({
  name:    z.string().min(2).max(100).trim(),
  email:   z.string().email(),
  eventId: z.string().uuid(),
})

// -- Action -------------------------------------------------------------------

export async function registerGuest(
  _prev: RegisterGuestState,
  formData: FormData,
): Promise<RegisterGuestState> {
  const parsed = schema.safeParse({
    name:    formData.get('name'),
    email:   formData.get('email'),
    eventId: formData.get('eventId'),
  })

  if (!parsed.success) {
    return { success: false, error: 'Please enter a valid name and email address.' }
  }

  const { name, email, eventId } = parsed.data
  const supabase = createServiceClient()

  // Verify event exists and has guest registration enabled
  const { data: event, error: eventError } = await supabase
    .from('calendar_events')
    .select('id, title, allow_guest_registration')
    .eq('id', eventId)
    .single()

  if (eventError || !event)            return { success: false, error: 'Event not found.' }
  if (!event.allow_guest_registration) return { success: false, error: 'Registration is not available for this event.' }

  // Generate token and expiry
  const token     = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { error: insertError } = await supabase
    .from('guest_registrations')
    .insert({ event_id: eventId, email, name, token, expires_at: expiresAt })

  if (insertError) return { success: false, error: 'Registration failed. Please try again.' }

  // Build magic link from request host
  const reqHeaders = await headers()
  const host       = reqHeaders.get('host') ?? 'tevd-portal.vercel.app'
  const protocol   = host.startsWith('localhost') ? 'http' : 'https'
  const magicLink  = `${protocol}://${host}/events/${eventId}/join?token=${token}`

  const html = await renderEmailTemplate(
    React.createElement(GuestEventMagicLinkEmail, {
      name,
      eventTitle:   event.title,
      magicLinkUrl: magicLink,
    }),
  )

  const result = await sendTransactionalEmail({
    to:       email,
    subject:  `Your link to join: ${event.title}`,
    html,
    template: 'guest_event_magic_link',
    meta:     { eventId, name },
  })

  if (!result.sent) return { success: false, error: 'Could not send access link. Please try again.' }

  return { success: true }
}
