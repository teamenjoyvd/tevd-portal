export default function PageContainer({ children, className = '' }: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  )
}