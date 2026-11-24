import { Img, Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding, labelStyle } from './_shell'

type Props = { name: string; code: string; entries: number; expiresLabel: string; qrSrc: string }

// Both languages in one email: an order does not record the buyer's language.
const COPY = {
  bg: {
    hi: (name: string) => `Здравейте, ${name},`,
    entries: 'Брой влизания',
    expires: 'Валиден до (вкл.)',
    use: 'Покажете QR кода на входа или въведете кода на страницата на събитието, за да се присъедините онлайн.',
    refund: 'Билетът не подлежи на възстановяване.',
  },
  en: {
    hi: (name: string) => `Hi ${name},`,
    entries: 'Entries',
    expires: 'Valid through',
    use: 'Show the QR code at the door, or enter the code on the event page to join online.',
    refund: 'This ticket is non-refundable.',
  },
} as const

export function TicketPassEmail({ name, code, entries, expiresLabel, qrSrc }: Props) {
  return (
    <EmailShell preview="Вашият билет / Your ticket" title="Вашият билет / Your ticket" lang="bg">
      <Section style={bodyPadding}>
        <Text style={{ fontFamily: 'monospace', fontSize: 28, letterSpacing: 4, color: '#111827', margin: '0 0 12px' }}>
          {code}
        </Text>
        <Img src={qrSrc} alt="QR" width="240" height="240" />
        {(['bg', 'en'] as const).map((lang) => {
          const c = COPY[lang]
          return (
            <React.Fragment key={lang}>
              <Text style={{ fontSize: 15, color: '#111827', margin: '24px 0 8px' }}>{c.hi(name)}</Text>
              <Text style={{ fontSize: 14, color: '#374151', margin: '0 0 8px' }}>{c.use}</Text>
              <Text style={{ ...labelStyle, margin: '0 0 4px' }}>
                {c.entries}: {entries} · {c.expires}: {expiresLabel}
              </Text>
              <Text style={{ fontSize: 13, color: '#374151', margin: '0' }}>{c.refund}</Text>
            </React.Fragment>
          )
        })}
      </Section>
    </EmailShell>
  )
}
