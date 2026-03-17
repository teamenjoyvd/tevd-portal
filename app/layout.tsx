import type { Metadata } from 'next'
import { Playfair_Display, Montserrat, Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import Providers from './providers'
import './globals.css'
import '../styles/brand-tokens.css'

const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-playfair',
  display: 'swap',
})

const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-montserrat',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '600'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'teamenjoyvd',
  description: 'Team Portal for teamenjoyVD',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" className={`${playfair.variable} ${montserrat.variable} ${cormorant.variable} ${dmSans.variable}`}>
        <body className="font-body" style={{ backgroundColor: 'var(--bg-global)', color: 'var(--text-primary)' }}>
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}