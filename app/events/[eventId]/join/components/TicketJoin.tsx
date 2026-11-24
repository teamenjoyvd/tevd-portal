import Link from 'next/link'
import type { createServiceClient } from '@/lib/supabase/service'
import { onlineWindow, windowOpens, type TicketFlow } from '@/lib/server/tickets/flow'
import { findJoinable, heldAdmissions } from '@/lib/server/tickets/held'
import { formatDateTime } from '@/lib/format'
import { t } from '@/lib/i18n'
import { BuyShell } from '../../buy/components/BuyShell'
import { TicketJoinCard } from '../../components/TicketJoinCard'
import { CodeJoinForm, LostCodeForm } from './CodeJoinForm'

type Props = { supabase: ReturnType<typeof createServiceClient>; flow: TicketFlow; admissionId: string | undefined; lang: 'en' | 'bg' }

const linkClass = 'block text-sm font-semibold underline'
const text = { color: 'var(--text-primary)' }

/** The join page of a ticketed event. */
export async function TicketJoin({ supabase, flow, admissionId, lang }: Props) {
  const { event } = flow
  const opens = onlineWindow(event)
  const [held, linked] = await Promise.all([
    heldAdmissions(supabase, event.id),
    admissionId === undefined ? null : findJoinable(supabase, event.id, admissionId),
  ])
  const heldIds = held.map((h) => h.id)
  // One keyed list, so a card keeps its state when pressing Join claims it.
  const places = linked === null ? held : [linked, ...held.filter((h) => h.id !== linked.id)]
  const blocked = event.cancelled ? t('tickets.err.cancelled', lang) : opens === 'over' ? t('tickets.code.over', lang) : null

  return (
    <BuyShell brand={t('event.join.brandName', lang)} title={event.title} subtitle={formatDateTime(event.start_time)}>
      {blocked !== null ? (
        <p className="text-sm" style={text}>{blocked}</p>
      ) : (
        <div className="space-y-6">
          {admissionId !== undefined && linked === null && (
            <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>{t('tickets.join.invalidLink', lang)}</p>
          )}
          {places.map((p) => <TicketJoinCard key={p.id} admissionId={p.id} name={p.name} lang={lang} held={heldIds.includes(p.id)} />)}
          {flow.kind === 'free' && (
            <Link href={`/events/${event.id}/register`} className={linkClass} style={text}>{t('tickets.register.submit', lang)}</Link>
          )}
          {flow.kind === 'closed' && <p className="text-sm" style={text}>{t('tickets.code.notOpen', lang)}</p>}
          {flow.kind === 'code' && (
            <div>
              {opens === 'before' ? (
                <p className="text-sm" style={text}>
                  {t('tickets.code.opens', lang).replace('{{time}}', formatDateTime(windowOpens(event.start_time)))}
                </p>
              ) : linked !== null ? (
                <details>
                  <summary className="text-sm cursor-pointer" style={text}>{t('tickets.join.otherPerson', lang)}</summary>
                  <div className="mt-4"><CodeJoinForm eventId={event.id} lang={lang} heldIds={heldIds} /></div>
                </details>
              ) : (
                <CodeJoinForm eventId={event.id} lang={lang} heldIds={heldIds} />
              )}
              <LostCodeForm lang={lang} />
            </div>
          )}
          {flow.selling && (
            <Link href={`/events/${event.id}/buy`} className={linkClass} style={text}>{t('tickets.code.buy', lang)}</Link>
          )}
        </div>
      )}
    </BuyShell>
  )
}
