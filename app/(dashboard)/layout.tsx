import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
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
  )
}
