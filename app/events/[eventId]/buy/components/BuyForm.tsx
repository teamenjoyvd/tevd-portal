'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'
import { t as translate, type TranslationKey } from '@/lib/i18n'
import { fetchJson } from '@/lib/utils/fetchJson'

type Product = { id: string; kind: 'single' | 'pack'; priceCents: number; entries: number; validityDays: number | null }
type Props = {
  eventId: string
  door: boolean
  lang: 'en' | 'bg'
  onlineOver: boolean
  products: Product[]
  initialName: string
  initialEmail: string
  publishableKey: string
}

const ERROR_KEYS: Record<string, TranslationKey> = {
  sales_closed: 'tickets.buy.closed',
  door_closed: 'tickets.buy.doorClosed',
  full: 'tickets.buy.full',
  rate_limited: 'tickets.buy.rateLimited',
  invalid_input: 'tickets.buy.invalid',
}
const INPUT_CLASS = 'w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm'
const INPUT_STYLE = { borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }

let stripePromise: Promise<Stripe | null> | null = null

export function BuyForm({ eventId, door, lang, onlineOver, products, initialName, initialEmail, publishableKey }: Props) {
  const t = (key: TranslationKey) => translate(key, lang)
  const [productId, setProductId] = useState(products[0].id)
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const product = products.find((p) => p.id === productId) ?? products[0]

  const checkout = useMutation({
    mutationFn: () => {
      stripePromise ??= loadStripe(publishableKey)
      return fetchJson<{ client_secret: string }>('/api/tickets/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, product_id: product.id, name, email, door, lang }),
      })
    },
  })

  if (checkout.data && stripePromise) {
    return (
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: checkout.data.client_secret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    )
  }

  const errorKey: TranslationKey =
    (checkout.error instanceof ApiError && checkout.error.code !== undefined ? ERROR_KEYS[checkout.error.code] : undefined) ??
    'tickets.buy.error'
  const note = (text: string) => <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{text}</p>

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!checkout.isPending) checkout.mutate()
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tickets.buy.choose')}</legend>
        {products.map((p) => (
          <label key={p.id} className="flex items-center gap-3 border rounded-xl px-3 py-3 text-sm cursor-pointer"
            style={{ borderColor: p.id === product.id ? 'var(--brand-crimson)' : 'var(--border-default)', color: 'var(--text-primary)' }}>
            <input type="radio" name="product" value={p.id} checked={p.id === product.id} onChange={() => setProductId(p.id)} />
            <span className="flex-1">
              {t(p.kind === 'pack' ? 'admin.tickets.kind.pack' : 'admin.tickets.kind.single')}
              {' · '}{t('admin.tickets.comp.entries')}: {p.entries}
            </span>
            <span className="font-semibold">{formatCurrency(p.priceCents / 100)}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="buy-name" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('tickets.buy.name')}</label>
        <input id="buy-name" required minLength={2} maxLength={200} autoComplete="name" value={name}
          onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
      </div>
      <div>
        <label htmlFor="buy-email" className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('tickets.buy.email')}</label>
        <input id="buy-email" type="email" required maxLength={320} autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
      </div>
      {door && note(t('tickets.buy.doorNote'))}
      {onlineOver && note(t(product.validityDays === null ? 'tickets.buy.onlineOver' : 'tickets.buy.onlineOverSeries'))}
      {product.validityDays !== null && note(t('tickets.buy.validity').replace('{{days}}', String(product.validityDays)))}
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tickets.buy.nonRefundable')}</p>
      {checkout.isError && <p className="text-sm" style={{ color: 'var(--status-alert-fg)' }} role="alert">{t(errorKey)}</p>}
      <button type="submit" disabled={checkout.isPending}
        className="w-full px-6 py-3 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--brand-crimson)' }}>
        {checkout.isPending ? t('tickets.buy.loading') : t('tickets.buy.pay')}
      </button>
    </form>
  )
}
