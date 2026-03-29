'use client'

import BentoCard from '@/components/bento/BentoCard'

export default function MailtoTile({ style }: { style?: React.CSSProperties }) {
  return (
    <BentoCard
      variant="crimson"
      className="flex flex-col items-center justify-center gap-2 cursor-pointer interactive-lift"
      style={style}
      onClick={() => { window.location.href = 'mailto:teamenjoyvd@gmail.com' }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--brand-parchment)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
      <span
        className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: 'var(--brand-parchment)', opacity: 0.7 }}
      >
        Email
      </span>
    </BentoCard>
  )
}
