'use client'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { Trip, PayableItem, ItemFormState } from './operations-types'
import { t } from '@/lib/i18n'

const ITEM_TYPES = ['merchandise', 'ticket', 'food', 'book', 'other'] as const

export function ItemForm({
  form,
  setForm,
  trips,
  error,
  isPending,
  isValid,
  editing,
  onSave,
  onClose,
}: {
  form: ItemFormState
  setForm: React.Dispatch<React.SetStateAction<ItemFormState>>
  trips: Trip[]
  error: string | null
  isPending: boolean
  isValid: boolean
  editing: PayableItem | null
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.items.lbl.title', 'en')}</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.items.lbl.type', 'en')}</label>
          <Select
            value={form.item_type}
            onValueChange={val => setForm(f => ({ ...f, item_type: val as ItemFormState['item_type'] }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ITEM_TYPES.map(tp => <SelectItem key={tp} value={tp}>{t(`admin.operations.items.type.${tp}` as Parameters<typeof t>[0], 'en')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.items.lbl.description', 'en')}</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={2} className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.items.lbl.amount', 'en')}</label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.items.lbl.currency', 'en')}</label>
          <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>
      {trips.length > 0 && (
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.items.lbl.linkedTrip', 'en')}</label>
          <Select
            value={form.linked_trip_id || 'none'}
            onValueChange={val => setForm(f => ({ ...f, linked_trip_id: val === 'none' ? '' : val }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('admin.operations.items.lbl.noTrip', 'en')}</SelectItem>
              {trips.map(tr => <SelectItem key={tr.id} value={tr.id}>{tr.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
          className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
          style={{ backgroundColor: form.is_active ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: form.is_active ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
          {form.is_active ? t('admin.operations.items.toggle.active', 'en') : t('admin.operations.items.toggle.inactive', 'en')}
        </button>
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onSave} disabled={isPending || !isValid}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {isPending ? t('admin.operations.items.btn.saving', 'en') : editing ? t('admin.operations.items.btn.saveChanges', 'en') : t('admin.operations.items.btn.create', 'en')}
        </button>
        <button onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {t('admin.operations.items.btn.cancel', 'en')}
        </button>
      </div>
    </div>
  )
}
