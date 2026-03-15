import type { Metadata } from 'next'
import { Playfair_Display, Montserrat } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import Providers from './providers'
import './globals.css'

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

export const metadata: Metadata = {
  title: 'teamenjoyVD Portal',
  description: 'N21 Community Portal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" className={`${playfair.variable} ${montserrat.variable}`}>
        <body className="font-sans bg-[#f4f1de] text-[#3d405b]">
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}