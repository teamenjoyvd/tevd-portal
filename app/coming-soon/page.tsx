'use client'

import Image from 'next/image'
import { useState } from 'react'

export default function ComingSoonPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || state === 'loading' || state === 'done') return
    setState('loading')
    try {
      const res = await fetch('/api/waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--brand-forest)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: 'Georgia, serif',
      }}
    >
      {/* Logo */}
      <Image
        src="/logo.png"
        alt="teamenjoyVD"
        width={120}
        height={120}
        style={{ objectFit: 'contain', marginBottom: '48px' }}
        priority
      />

      {/* Heading */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <p
          style={{
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--brand-crimson)',
            margin: '0 0 16px',
          }}
        >
          teamenjoyVD
        </p>
        <h1
          style={{
            fontSize: 'clamp(36px, 8vw, 72px)',
            fontWeight: 'normal',
            color: 'var(--brand-parchment)',
            margin: '0 0 16px',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          Coming Soon
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: 'rgba(250,248,243,0.5)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Something is being built. Leave your email and we&apos;ll let you know.
        </p>
      </div>

      {/* Email capture */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {state !== 'done' ? (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={state === 'loading'}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(250,248,243,0.06)',
                border: '1px solid rgba(250,248,243,0.15)',
                borderRadius: '4px',
                color: 'var(--brand-parchment)',
                fontSize: '16px',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'var(--brand-crimson)',
                border: 'none',
                borderRadius: '4px',
                color: 'var(--brand-parchment)',
                fontSize: '14px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: 'inherit',
                cursor: state === 'loading' ? 'wait' : 'pointer',
                opacity: state === 'loading' ? 0.7 : 1,
              }}
            >
              {state === 'loading' ? 'Saving...' : 'Notify me'}
            </button>
            {state === 'error' && (
              <p style={{ color: 'var(--brand-crimson)', fontSize: '14px', margin: 0, textAlign: 'center' }}>
                Something went wrong. Try again.
              </p>
            )}
          </>
        ) : (
          <p
            style={{
              color: 'var(--brand-parchment)',
              fontSize: '16px',
              textAlign: 'center',
              margin: 0,
              padding: '14px 0',
              borderTop: '1px solid rgba(250,248,243,0.15)',
            }}
          >
            You&apos;re on the list. We&apos;ll be in touch.
          </p>
        )}
      </form>
    </main>
  )
}
