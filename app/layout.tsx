import type { Metadata } from 'next'
import { Playfair_Display, Montserrat, Cormorant_Garamond } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { cookies } from 'next/headers'
import type { Lang } from '@/lib/i18n/translations'
import { LangProvider } from '@/lib/context/LangProvider'
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
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '600'],
  variable: '--font-cormorant',
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
  const lang = (cookieStore.get('tevd_lang')?.value === 'bg' ? 'bg' : 'en') as Lang

  return (
    <ClerkProvider afterSignOutUrl="/">
      <html
        lang={lang}
        data-font-size={fontSizeCookie}
        className={`${playfair.variable} ${montserrat.variable} ${cormorant.variable}`}
      >
        <head>
          {/*
            Blocking inline script: apply stored theme + gate the bento-enter
            animation BEFORE first paint. Merged into one script tag to avoid a
            second parser-blocking round-trip; both must still run synchronously
            during HTML parse (before first paint), so this stays inline/non-deferred.
            - Theme: prevents flash-of-light-mode on refresh when dark is stored.
            - Animation gate (SEQ298): sessionStorage persists across hard reloads
              (Ctrl+F5) within a session but clears on new tab / browser restart —
              matching 'first ever load' exactly. On subsequent loads
              data-animated="done" is set before paint, suppressing the animation
              via CSS before any tile mounts.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('tevd-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}try{if(sessionStorage.getItem('tevd-visited')){document.documentElement.setAttribute('data-animated','done');}else{sessionStorage.setItem('tevd-visited','1');}}catch(e){}})();`,
            }}
          />
        </head>
        <body className="font-body" style={{ backgroundColor: 'var(--bg-global)', color: 'var(--text-primary)' }}>
          <LangProvider initialLang={lang}>
            <Providers>
              {children}
            </Providers>
          </LangProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
