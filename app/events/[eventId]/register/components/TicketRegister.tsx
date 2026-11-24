import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import type { createServiceClient } from '@/lib/supabase/service'
import { onlineWindow, type TicketFlow } from '@/lib/server/tickets/flow'
import { heldAdmissions } from '@/lib/server/tickets/held'
import { formatDateTime } from '@/lib/format'
import { t } from '@/lib/i18n'
import { BuyShell } from '../../buy/components/BuyShell'
import { TicketJoinCard } from '../../components/TicketJoinCard'
import { TicketRegisterForm } from './TicketRegisterForm'

type Props = { supabase: ReturnType<typeof createServiceClient>; flow: TicketFlow; lang: 'en' | 'bg' }

/** The same address registerFree() enforces: the verified primary one. */
async function loadMember(supabase: Props['supabase']) {
  const { userId } = await auth()
  if (!userId) return null
  const email = (await currentUser())?.primaryEmailAddress
  if (email?.verification?.status !== 'verified') return null
  const { data, error } = await supabase.from('profiles').select('first_name, last_name').eq('clerk_id', userId).maybeSingle()
  if (error) throw error
  return data === null ? null : {
    name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
    email: email.emailAddress.toLowerCase(),
  }
}

/** The register page of a ticketed event. */
export async function TicketRegister({ supabase, flow, lang }: Props) {
  const { event } = flow
  if (flow.kind === 'code') redirect(`/events/${event.id}/join`)

  const blocked =
    event.cancelled ? 'tickets.err.cancelled'
    : onlineWindow(event) === 'over' ? 'tickets.code.over'
    : flow.kind === 'closed' ? 'tickets.code.notOpen'
    : null
  const [held, member] = blocked === null ? await Promise.all([heldAdmissions(supabase, event.id), loadMember(supabase)]) : [[], null]

  return (
    <BuyShell brand={t('event.join.brandName', lang)} title={event.title} subtitle={formatDateTime(event.start_time)}>
      {blocked !== null ? (
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{t(blocked, lang)}</p>
      ) : (
        <TicketRegisterForm eventId={event.id} lang={lang} member={member} heldIds={held.map((h) => h.id)} />
      )}
      {held.length > 0 && (
        <div className="space-y-4 mt-6 pt-6" style={{ borderTop: '1px solid var(--border-default)' }}>
          {held.map((h) => <TicketJoinCard key={h.id} admissionId={h.id} name={h.name} lang={lang} held />)}
        </div>
      )}
    </BuyShell>
  )
}
