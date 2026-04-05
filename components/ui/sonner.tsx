'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
        },
        classNames: {
          error:
            'border-[var(--brand-crimson)] text-[var(--brand-crimson)]',
          title: 'font-medium text-sm',
          description: 'text-xs opacity-80',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
