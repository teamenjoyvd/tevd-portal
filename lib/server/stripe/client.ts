import Stripe from 'stripe'

let cached: Stripe | null = null

/**
 * The only way the publishable key reaches a page. Swapped variables would
 * publish the secret key, so anything that is not a pk_ key is refused.
 */
export function getPublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
  return /^pk_(test|live)_/.test(key) ? key : null
}

const isSecretKey = (key: string | undefined): key is string => key !== undefined && /^(sk|rk)_(test|live)_/.test(key)

export function isStripeConfigured(): boolean {
  return isSecretKey(process.env.STRIPE_SECRET_KEY) && getPublishableKey() !== null
}

/** A live key outside production would charge real cards from a preview. */
export function assertKeyMatchesEnvironment(key: string): void {
  if (!/^(sk|rk)_test_/.test(key) && process.env.VERCEL_ENV !== 'production') {
    throw new Error('Only Stripe test keys may be used outside production')
  }
}

export function getStripe(): Stripe {
  if (cached !== null) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!isSecretKey(key)) throw new Error('STRIPE_SECRET_KEY is not a Stripe secret key')
  assertKeyMatchesEnvironment(key)
  cached = new Stripe(key, { apiVersion: '2026-11-18.endive' })
  return cached
}
