'use client'

export function BentoEmpty({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6">
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{message}</p>
      {hint && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{hint}</p>
      )}
    </div>
  )
}
