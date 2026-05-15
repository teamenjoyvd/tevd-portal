import { ItemCreateForm } from './components/ItemCreateForm'

export default function ItemNewPage() {
  return (
    <div className="space-y-6 pb-16">
      <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        New Item
      </h1>
      <ItemCreateForm />
    </div>
  )
}
