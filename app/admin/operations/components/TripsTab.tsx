'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate, formatCurrency } from '@/lib/format'
import { Drawer } from '@/components/ui/drawer'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { TripForm, type TripFormState, type MilestoneInputState } from './TripForm'
import { t } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────

export type Milestone = { label: string; amount: number; due_date: string }

export type Trip = {
  id: string; title: string; destination: string
  start_date: string; end_date: string
  total_cost: number; milestones: Milestone[]
  currency: string; description: string
  location: string | null; accommodation_type: string | null
  inclusions: string[]; trip_type: string | null
  visibility_roles: string[]
}

// ── Constants ────────────────────────────────────────────

export const ALL_ROLES = ['guest', 'member', 'core', 'admin']

// ── Helpers ──────────────────────────────────────────────

const emptyTrip = (): TripFormState => ({
  title: '', destination: '', description: '',
  start_date: '', end_date: '', total_cost: 0, milestones: [],
  location: null, accommodation_type: null,
  inclusions: [], trip_type: null,
  visibility_roles: [...ALL_ROLES],
})

// ── Component ────────────────────────────────────────────

export function TripsTab({ trips, isLoading }: { trips: Trip[]; isLoading: boolean }) {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Trip | null>(null)
  const [form, setForm] = useState<TripFormState>(emptyTrip())
  const [milestoneInput, setMilestoneInput] = useState<MilestoneInputState>({ label: '', amount: '', due_date: '' })
  const [error, setError] = useState<string | null>(null)
  const [alertTarget, setAlertTarget] = useState<{ id: string; name: string } | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyTrip())
    setMilestoneInput({ label: '', amount: '', due_date: '' })
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(trip: Trip) {
    setEditing(trip)
    setForm({
      title: trip.title,
      destination: trip.destination,
      description: trip.description,
      start_date: trip.start_date,
      end_date: trip.end_date,
      total_cost: trip.total_cost,
      milestones: Array.isArray(trip.milestones) ? trip.milestones : [],
      location: trip.location,
      accommodation_type: trip.accommodation_type,
      inclusions: Array.isArray(trip.inclusions) ? trip.inclusions : [],
      trip_type: trip.trip_type,
      visibility_roles: Array.isArray(trip.visibility_roles) ? trip.visibility_roles : [...ALL_ROLES],
    })
    setMilestoneInput({ label: '', amount: '', due_date: '' })
    setError(null)
    setDrawerOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (body: TripFormState) =>
      fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setDrawerOpen(false); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Omit<Trip, 'currency'>) =>
      fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setDrawerOpen(false); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/trips/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  })

  function handleSave() {
    if (editing) updateMutation.mutate({ id: editing.id, ...form })
    else createMutation.mutate(form)
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const isValid = !!form.title && !!form.destination && !!form.start_date && !!form.end_date

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {t('admin.operations.trips.btn.new', 'en')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />)}
        </div>
      ) : trips.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.trips.empty', 'en')}</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {trips.map((trip, i) => (
            <div key={trip.id} className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{trip.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {trip.destination} · {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                  {' · '}{formatCurrency(trip.total_cost, 'EUR')}
                  {' · '}{trip.milestones?.length ?? 0} {t('admin.operations.trips.milestones', 'en').replace('{{count}} ', '')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Link
                  href={`/admin/trips/${trip.id}`}
                  className="text-xs hover:opacity-70 transition-opacity font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Manage →
                </Link>
                <button onClick={() => openEdit(trip)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.trips.btn.edit', 'en')}</button>
                <button
                  onClick={() => setAlertTarget({ id: trip.id, name: trip.title })}
                  className="text-xs hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--brand-crimson)' }}
                >{t('admin.operations.trips.btn.delete', 'en')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? t('admin.operations.trips.title.edit', 'en').replace('{{title}}', editing.title) : t('admin.operations.form.btn.createTrip', 'en')}>
        <TripForm
          form={form}
          setForm={setForm}
          milestoneInput={milestoneInput}
          setMilestoneInput={setMilestoneInput}
          error={error}
          isPending={isPending}
          isValid={isValid}
          editing={editing}
          onSave={handleSave}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>

      <AlertDialog open={!!alertTarget} onOpenChange={open => { if (!open) setAlertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.operations.trips.dialog.title', 'en')}</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{alertTarget?.name}&rdquo;? {t('admin.operations.trips.dialog.body', 'en')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.operations.trips.dialog.cancel', 'en')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (alertTarget) deleteMutation.mutate(alertTarget.id)
                setAlertTarget(null)
              }}
            >
              {t('admin.operations.trips.dialog.confirm', 'en')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
