import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'

const clerkAppearance = {
  elements: {
    rootBox: 'w-full',
    card: 'shadow-xl rounded-2xl border border-black/5',
    headerTitle: 'font-display',
    headerSubtitle: 'font-body',
    formButtonPrimary:
      'bg-[#bc4749] hover:bg-[#a33d3f] text-white font-body font-semibold rounded-xl transition-opacity',
    formFieldInput:
      'rounded-xl border-black/10 font-body focus:border-[#bc4749] focus:ring-[#bc4749]',
    footerActionLink: 'text-[#bc4749] font-body hover:text-[#a33d3f]',
    identityPreviewEditButton: 'text-[#bc4749]',
    socialButtonsBlockButton: 'rounded-xl border-black/10 font-body',
    dividerLine: 'bg-black/10',
  },
}

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--brand-parchment)' }}
    >
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image src="/logo.png" alt="teamenjoyVD" width={52} height={52} className="rounded-full" />
        <span
          className="font-display text-xl font-bold tracking-tight"
          style={{ color: 'var(--brand-forest)' }}
        >
          TEAMENJOY<span style={{ color: 'var(--brand-crimson)' }}>VD</span>
        </span>
      </div>
      <SignIn appearance={clerkAppearance} />
    </div>
  )
}
