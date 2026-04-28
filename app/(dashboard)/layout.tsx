import { cookies } from 'next/headers'
import type { Lang } from '@/lib/i18n/translations'
import { LangProvider } from '@/lib/context/LangProvider'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const lang = (
    cookieStore.get('tevd_lang')?.value === 'bg' ? 'bg' : 'en'
  ) as Lang

  return (
    <LangProvider initialLang={lang}>
      <div
        className="min-h-screen flex flex-col"
        style={{ backgroundColor: 'var(--bg-global)' }}
      >
        <Header />
        <main
          className="flex-1 pt-20"
          style={{ backgroundColor: 'var(--bg-global)' }}
        >
          {children}
        </main>
        <Footer />
      </div>
    </LangProvider>
  )
}
