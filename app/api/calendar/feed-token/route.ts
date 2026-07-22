import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { signIcalToken, IcalTokenConfigError } from '@/lib/server/icalToken'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, ical_token')
    .eq('clerk_id', userId)
    .single()

  if (error || !profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Return existing token if already generated
  if (profile.ical_token) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tevd-portal.vercel.app'
    return Response.json({
      token: profile.ical_token,
      url: `${baseUrl}/api/calendar/feed.ics?token=${profile.ical_token}`,
    })
  }

  // Generate new signed JWT — no expiry, permanent subscription URL
  let token: string
  try {
    token = await signIcalToken({ profile_id: profile.id, role: profile.role })
  } catch (err) {
    if (err instanceof IcalTokenConfigError) {
      return Response.json({ error: 'Calendar service unavailable' }, { status: 503 })
    }
    throw err
  }

  // Store token in profile
  await supabase
    .from('profiles')
    .update({ ical_token: token })
    .eq('id', profile.id)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tevd-portal.vercel.app'
  return Response.json({
    token,
    url: `${baseUrl}/api/calendar/feed.ics?token=${token}`,
  })
}

// POST regenerates the token (revokes old one)
export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single()

  if (error || !profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  let token: string
  try {
    token = await signIcalToken({ profile_id: profile.id, role: profile.role })
  } catch (err) {
    if (err instanceof IcalTokenConfigError) {
      return Response.json({ error: 'Calendar service unavailable' }, { status: 503 })
    }
    throw err
  }

  await supabase
    .from('profiles')
    .update({ ical_token: token })
    .eq('id', profile.id)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tevd-portal.vercel.app'
  return Response.json({
    token,
    url: `${baseUrl}/api/calendar/feed.ics?token=${token}`,
  })
}
