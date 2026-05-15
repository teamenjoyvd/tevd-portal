import { TripCreateForm } from './components/TripCreateForm'

export default function TripNewPage() {
  return (
    <div className="space-y-6 pb-16">
      <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        New Trip
      </h1>
      <TripCreateForm />
    </div>
  )
}
