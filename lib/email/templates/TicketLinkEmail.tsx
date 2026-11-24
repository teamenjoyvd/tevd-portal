import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailShell, bodyPadding } from './_shell'

type Props = { name: string } & ({ url: string; code?: never } | { code: string; url?: never })

const COPY = {
  bg: {
    hi: (name: string) => `Здравейте, ${name},`,
    link: 'Отворете връзката на устройството, с което ще се включите. Първото устройство става ваше.',
    code: 'Въведете този код, за да се включите от това устройство. Валиден е 10 минути. Ако не сте го поискали, не го давайте на никого.',
    button: 'Към включването',
  },
  en: {
    hi: (name: string) => `Hi ${name},`,
    link: 'Open the link on the device you will join with. The first device becomes yours.',
    code: 'Enter this code to join from this device. It is valid for 10 minutes. If you did not ask for it, give it to no one.',
    button: 'Go to join page',
  },
} as const

export function TicketLinkEmail({ name, url, code }: Props) {
  const title = code === undefined ? 'Вашата връзка / Your link' : 'Еднократен код / One-time code'
  return (
    <EmailShell preview={title} title={title} lang="bg">
      <Section style={bodyPadding}>
        {code !== undefined && (
          <Text style={{ fontFamily: 'monospace', fontSize: 28, letterSpacing: 4, color: '#111827', margin: '0 0 12px' }}>{code}</Text>
        )}
        {(['bg', 'en'] as const).map((lang) => {
          const c = COPY[lang]
          return (
            <React.Fragment key={lang}>
              <Text style={{ fontSize: 15, color: '#111827', margin: '16px 0 8px' }}>{c.hi(name)}</Text>
              <Text style={{ fontSize: 14, color: '#374151', margin: '0 0 8px' }}>{code === undefined ? c.link : c.code}</Text>
              {url !== undefined && (
                <Button href={url} style={{
                  backgroundColor: '#1a3c2e', color: '#ffffff', borderRadius: 8, padding: '12px 28px',
                  fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block',
                }}>
                  {c.button}
                </Button>
              )}
            </React.Fragment>
          )
        })}
      </Section>
    </EmailShell>
  )
}
