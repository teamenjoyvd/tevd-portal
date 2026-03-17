import Header from '@/components/layout/Header'
import BottomNav from '@/components/layout/BottomNav'
import Footer from '@/components/layout/Footer'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-global)' }}>
      <Header />
      <main className="flex-1 pt-20 pb-20 md:pb-0" style={{ backgroundColor: 'var(--bg-global)' }}>
        {children}
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}