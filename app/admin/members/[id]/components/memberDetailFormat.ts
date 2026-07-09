export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatEur(n: number) {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export const STATUS_PILL: Record<string, string> = {
  pending:   'bg-[#f2cc8f33] text-[#7a5c00]',
  approved:  'bg-[#81b29a33] text-[#2d6a4f]',
  denied:    'bg-[#bc474920] text-[#bc4749]',
  completed: 'bg-[#81b29a33] text-[#2d6a4f]',
  failed:    'bg-[#bc474920] text-[#bc4749]',
}
