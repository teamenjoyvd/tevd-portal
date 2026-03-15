import Header from '@/components/layout/Header'
import BottomNav from '@/components/layout/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--eggshell)' }}>
      <Header />
      <main className="pb-24 md:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}