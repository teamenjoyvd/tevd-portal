import type { Metadata } from 'next'
import { Playfair_Display, Montserrat, Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { cookies } from 'next/headers'
import Providers from './providers'
import PageTransition from '@/components/layout/PageTransition'
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

// SEQ277: 'sm' removed, 'xl' added to match useFontSize.ts ALLOWED array.
const ALLOWED_FONT_SIZES = ['md', 'lg', 'xl'] as const
type FontSizeCookie = typeof ALLOWED_FONT_SIZES[number]

function resolveFont(raw: string | undefined): FontSizeCookie {
  return (ALLOWED_FONT_SIZES as readonly string[]).includes(raw ?? '') ? (raw as FontSizeCookie) : 'md'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const fontSizeCookie = resolveFont(cookieStore.get('tevd-font-size')?.value)

  return (
    <ClerkProvider afterSignOutUrl="/">
      <html
        lang="en"
        data-font-size={fontSizeCookie}
        className={`${playfair.variable} ${montserrat.variable} ${cormorant.variable} ${dmSans.variable}`}
      >
        <head>
          {/*
            Blocking inline script: apply stored theme BEFORE first paint.
            This prevents the flash-of-light-mode on refresh when dark is stored.
            Must be inline (not deferred/async) so it runs synchronously during HTML parse.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('tevd-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
            }}
          />
        </head>
        <body className="font-body" style={{ backgroundColor: 'var(--bg-global)', color: 'var(--text-primary)' }}>
          <Providers>
            <PageTransition>
              {children}
            </PageTransition>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
