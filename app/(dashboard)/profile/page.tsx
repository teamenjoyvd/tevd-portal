'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Drawer } from '@/components/ui/Drawer'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { PersonalDetailsContent } from './components/PersonalDetailsContent'
import { AboInfoContent } from './components/AboInfoContent'
import { TravelDocContent } from './components/TravelDocContent'
import { UserSettingsContent } from './components/UserSettingsContent'
import { PersonalDrawerForm } from './components/PersonalDrawerForm'
import { TravelDocDrawerForm } from './components/TravelDocDrawerForm'
import { SortableBento } from './components/SortableBento'
import { TripsSection, TRIPS_MIN_HEIGHT } from './components/TripsSection'
import { PaymentsSection, PAYMENTS_MIN_HEIGHT } from './components/PaymentsSection'
import { VitalsSection, VITALS_MIN_HEIGHT } from './components/VitalsSection'
import { ParticipationSection, PARTICIPATION_MIN_HEIGHT } from './components/ParticipationSection'
import { CalendarSection, CALENDAR_MIN_HEIGHT } from './components/CalendarSection'
import { StatsSection, STATS_MIN_HEIGHT } from './components/StatsSection'
import { AdminSection } from './components/AdminSection'
import { type Profile } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

const BENTO_HEIGHT = { S: 160, M: 280 } as const

const BENTO_IDS = {
  PERSONAL_DETAILS: 'personal-details',
  ABO_INFO:         'abo-info',
  TRAVEL_DOC:       'travel-doc',
  SETTINGS:         'settings',
  TRIPS:            'trips',
  PAYMENTS:         'payments',
  VITALS:           'vitals',
  PARTICIPATION:    'participation',
  CALENDAR:         'calendar',
  STATS:            'stats',
  ADMIN:            'admin',
}

const DEFAULT_ORDER: string[] = [
  BENTO_IDS.PERSONAL_DETAILS,
  BENTO_IDS.ABO_INFO,
  BENTO_IDS.TRIPS,
  BENTO_IDS.PAYMENTS,
  BENTO_IDS.VITALS,
  BENTO_IDS.PARTICIPATION,
  BENTO_IDS.SETTINGS,
  BENTO_IDS.TRAVEL_DOC,
  BENTO_IDS.CALENDAR,
  BENTO_IDS.STATS,
  BENTO_IDS.ADMIN,
]

// ── Validation (personal + travel doc) ───────────────────────────────────────

type PersonalFormFields = {
  first_name?: string
  last_name?: string
  bg_first?: string
  bg_last?: string
  phone?: string
  contact_email?: string
}

const LATIN_RE    = /^[A-Za-z\-']+$/
const CYRILLIC_RE = /^[\u0400-\u04FF\-']+$/
const PHONE_RE    = /^\+?\d{7,15}$/
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePersonalField(field: keyof PersonalFormFields, value: string): string {
  switch (field) {
    case 'first_name':
      if (!value.trim()) return 'Required'
      if (!LATIN_RE.test(value.trim())) return 'Latin letters, hyphens and apostrophes only'
      return ''
    case 'last_name':
      if (!value.trim()) return 'Required'
      if (!LATIN_RE.test(value.trim())) return 'Latin letters, hyphens and apostrophes only'
      return ''
    case 'bg_first':
      if (!value.trim()) return ''
      if (!CYRILLIC_RE.test(value.trim())) return 'Cyrillic letters, hyphens and apostrophes only'
      return ''
    case 'bg_last':
      if (!value.trim()) return ''
      if (!CYRILLIC_RE.test(value.trim())) return 'Cyrillic letters, hyphens and apostrophes only'
      return ''
    case 'phone':
      if (!value.trim()) return ''
      if (!PHONE_RE.test(value.trim())) return 'Enter a valid phone number (7–15 digits, optional leading +)'
      return ''
    case 'contact_email':
      if (!value.trim()) return ''
      if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address'
      return ''
    default:
      return ''
  }
}

function validateDocField(
  field: 'doc_number' | 'valid_through',
  value: string,
  context: { has_doc_type: boolean; doc_number: string },
): string {
  if (field === 'doc_number') {
    if (context.has_doc_type && !value.trim()) return 'Required when document type is set'
    return ''
  }
  if (field === 'valid_through') {
    if (!context.doc_number.trim()) return ''
    if (!value.trim()) return 'Required when document number is filled'
    if (isNaN(new Date(value).getTime())) return 'Enter a valid date'
    return ''
  }
  return ''
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="py-8 pb-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ gridColumn: 'span 6', minHeight: BENTO_HEIGHT.M }} className="bento-mobile-full">
              <div className="h-full rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const qc = useQueryClient()
  const { t } = useLanguage()

  // ── Personal + travel doc drawer states (deferred to SEQ339) ────────────
  const [personalDrawerOpen, setPersonalDrawerOpen]   = useState(false)
  const [travelDocDrawerOpen, setTravelDocDrawerOpen] = useState(false)
  const [savedPersonal, setSavedPersonal]             = useState(false)
  const [savedTravelDoc, setSavedTravelDoc]           = useState(false)

  const [personalForm, setPersonalForm] = useState<{
    first_name?: string
    last_name?: string
    display_names?: Record<string, string>
    phone?: string
    contact_email?: string
  }>({})
  const [personalErrors, setPersonalErrors] = useState<Partial<Record<keyof PersonalFormFields, string>>>({})
  const [docForm, setDocForm] = useState<{
    document_active_type?: 'id' | 'passport'
    id_number?: string
    passport_number?: string
    valid_through?: string
  }>({})
  const [docErrors, setDocErrors] = useState<{ doc_number?: string; valid_through?: string }>({})

  // ── Layout state ─────────────────────────────────────────────────────────
  const [bentoOrder, setBentoOrder]         = useState<string[]>(DEFAULT_ORDER)
  const [bentoCollapsed, setBentoCollapsed] = useState<Record<string, boolean>>({})
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Profile query (page gate) ─────────────────────────────────────────────
  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
  })

  const validProfile = profile?.id ? profile : null

  // ── ABO + upline queries (needed for AboInfoContent + bentoMap gating) ───
  const { data: verRequest } = useQuery<{ id: string; claimed_abo: string | null; claimed_upline_abo: string; status: 'pending' | 'approved' | 'denied'; admin_note: string | null; created_at: string; request_type: string } | null>({
    queryKey: ['verify-abo'],
    queryFn: () => fetch('/api/profile/verify-abo').then(r => r.json()),
    enabled: !!validProfile && validProfile.role === 'guest',
  })

  const { data: uplineData } = useQuery<{ upline_name: string | null; upline_abo_number: string | null }>({
    queryKey: ['profile-upline'],
    queryFn: () => fetch('/api/profile/upline').then(r => r.json()),
    enabled: !!validProfile?.abo_number,
    staleTime: 10 * 60 * 1000,
  })

  const submitVerification = useMutation({
    mutationFn: (params: { claimed_abo?: string; claimed_upline_abo: string; request_type: 'standard' | 'manual' }) =>
      fetch('/api/profile/verify-abo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          params.request_type === 'manual'
            ? { request_type: 'manual', claimed_upline_abo: params.claimed_upline_abo }
            : { claimed_abo: params.claimed_abo, claimed_upline_abo: params.claimed_upline_abo }
        ),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  const cancelVerification = useMutation({
    mutationFn: () => fetch('/api/profile/verify-abo', { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify-abo'] }),
  })

  // ── Restore persisted bento layout ───────────────────────────────────────
  useEffect(() => {
    if (!validProfile) return
    const prefs = validProfile.ui_prefs ?? {}
    if (Array.isArray(prefs.bento_order) && prefs.bento_order.length > 0) {
      const savedOrder = prefs.bento_order as string[]
      const merged = [
        ...savedOrder.filter(id => DEFAULT_ORDER.includes(id)),
        ...DEFAULT_ORDER.filter(id => !savedOrder.includes(id)),
      ]
      setBentoOrder(merged)
    }
    if (prefs.bento_collapsed && typeof prefs.bento_collapsed === 'object') {
      setBentoCollapsed(prefs.bento_collapsed as Record<string, boolean>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validProfile?.id])

  // ── Seed personal + doc form state ───────────────────────────────────────
  useEffect(() => {
    if (!validProfile) return
    setPersonalForm({
      first_name:    validProfile.first_name,
      last_name:     validProfile.last_name,
      display_names: validProfile.display_names ?? {},
      phone:         validProfile.phone ?? '',
      contact_email: validProfile.contact_email ?? '',
    })
    setDocForm({
      document_active_type: validProfile.document_active_type,
      id_number:            validProfile.id_number ?? '',
      passport_number:      validProfile.passport_number ?? '',
      valid_through:        validProfile.valid_through ?? '',
    })
  }, [validProfile])

  // ── Personal + doc mutations ──────────────────────────────────────────────
  const savePersonal = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name:    personalForm.first_name,
        last_name:     personalForm.last_name,
        display_names: personalForm.display_names,
        phone:         personalForm.phone || null,
        contact_email: personalForm.contact_email || null,
      }
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      return r.json() as Promise<Profile>
    },
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setSavedPersonal(true)
      setPersonalDrawerOpen(false)
      setPersonalErrors({})
      setTimeout(() => setSavedPersonal(false), 2500)
    },
  })

  const saveTravelDoc = useMutation({
    mutationFn: async () => {
      const payload = {
        document_active_type: docForm.document_active_type,
        id_number:       docForm.id_number       || null,
        passport_number: docForm.passport_number || null,
        valid_through:   docForm.valid_through   || null,
      }
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      return r.json() as Promise<Profile>
    },
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setSavedTravelDoc(true)
      setTravelDocDrawerOpen(false)
      setDocErrors({})
      setTimeout(() => setSavedTravelDoc(false), 2500)
    },
  })

  // ── Personal form helpers ─────────────────────────────────────────────────
  function handlePersonalChange(field: keyof PersonalFormFields, value: string) {
    if (field === 'bg_first' || field === 'bg_last') {
      const dnKey = field === 'bg_first' ? 'bg_first' : 'bg_last'
      setPersonalForm(f => ({ ...f, display_names: { ...((f.display_names ?? {}) as Record<string,string>), [dnKey]: value } }))
    } else {
      setPersonalForm(f => ({ ...f, [field]: value }))
    }
  }
  function handlePersonalBlur(field: keyof PersonalFormFields, value: string) {
    setPersonalErrors(prev => ({ ...prev, [field]: validatePersonalField(field, value) }))
  }
  function clearPersonalError(field: keyof PersonalFormFields) {
    setPersonalErrors(prev => { if (!prev[field]) return prev; const n = { ...prev }; delete n[field]; return n })
  }

  // ── Travel doc form helpers ───────────────────────────────────────────────
  function handleDocTypeChange(dt: 'id' | 'passport') {
    setDocForm(f => ({ ...f, document_active_type: dt }))
  }
  function handleDocNumberChange(v: string) {
    const field = docForm.document_active_type === 'passport' ? 'passport_number' : 'id_number'
    setDocForm(f => ({ ...f, [field]: v }))
  }
  function handleDocNumberBlur(v: string) {
    const err = validateDocField('doc_number', v, { has_doc_type: !!(docForm.document_active_type), doc_number: v })
    setDocErrors(prev => ({ ...prev, doc_number: err }))
  }
  function handleValidThroughBlur(v: string) {
    const docNumber = docForm.document_active_type === 'passport' ? (docForm.passport_number ?? '') : (docForm.id_number ?? '')
    const err = validateDocField('valid_through', v, { has_doc_type: true, doc_number: docNumber })
    setDocErrors(prev => ({ ...prev, valid_through: err }))
  }
  function clearDocError(f: 'doc_number' | 'valid_through') {
    setDocErrors(prev => { const n = { ...prev }; delete n[f]; return n })
  }

  // ── Persist bento prefs ───────────────────────────────────────────────────
  const persistPrefs = useCallback((order: string[], collapsed: Record<string, boolean>) => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current)
    persistDebounceRef.current = setTimeout(() => {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_prefs: { bento_order: order, bento_collapsed: collapsed } }),
      }).catch(() => { /* silent */ })
    }, 500)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBentoOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string)
      const newIndex = prev.indexOf(over.id as string)
      const next = arrayMove(prev, oldIndex, newIndex)
      persistPrefs(next, bentoCollapsed)
      return next
    })
  }, [bentoCollapsed, persistPrefs])

  const toggleCollapse = useCallback((id: string) => {
    setBentoCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] }
      setBentoOrder(order => { persistPrefs(order, next); return order })
      return next
    })
  }, [persistPrefs])

  const resetLayout = useCallback(() => {
    setBentoOrder(DEFAULT_ORDER)
    setBentoCollapsed({})
    persistPrefs(DEFAULT_ORDER, {})
  }, [persistPrefs])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (isLoading || !validProfile) return <ProfileSkeleton />

  const p = validProfile
  const isGuest = p.role === 'guest' && !p.abo_number
  const isAdmin = p.role === 'admin'

  type AboMode = 'form' | 'pending' | 'confirmed' | 'member_manual'
  let aboMode: AboMode = 'form'
  if (p.abo_number) {
    aboMode = 'confirmed'
  } else if (p.role !== 'guest') {
    aboMode = 'member_manual'
  } else if (verRequest && (verRequest.status === 'pending' || verRequest.status === 'denied')) {
    aboMode = 'pending'
  }

  // ── Bento map ─────────────────────────────────────────────────────────────
  type BentoEntry = { colSpan: number; minHeight: number; node: React.ReactNode }

  const bentoMap: Record<string, BentoEntry | null> = {
    [BENTO_IDS.PERSONAL_DETAILS]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: <PersonalDetailsContent profile={p} incomplete={!p.first_name} onEdit={() => setPersonalDrawerOpen(true)} />,
    },
    [BENTO_IDS.ABO_INFO]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: (
        <AboInfoContent
          mode={aboMode} role={p.role} aboNumber={p.abo_number}
          uplineData={uplineData} verRequest={verRequest}
          onSubmitVerification={params => submitVerification.mutate(params)}
          onCancelVerification={() => cancelVerification.mutate()}
          submitPending={submitVerification.isPending}
          cancelPending={cancelVerification.isPending}
          submitError={submitVerification.isError ? (submitVerification.error as Error).message : null}
        />
      ),
    },
    [BENTO_IDS.TRAVEL_DOC]: !isGuest ? {
      colSpan: 6, minHeight: BENTO_HEIGHT.S,
      node: <TravelDocContent profile={p} onEdit={() => setTravelDocDrawerOpen(true)} />,
    } : null,
    [BENTO_IDS.SETTINGS]: {
      colSpan: 6, minHeight: BENTO_HEIGHT.M,
      node: <UserSettingsContent />,
    },
    [BENTO_IDS.TRIPS]: !isGuest ? {
      colSpan: 6, minHeight: TRIPS_MIN_HEIGHT,
      node: <TripsSection profileId={p.id} role={p.role} />,
    } : null,
    [BENTO_IDS.PAYMENTS]: !isGuest ? {
      colSpan: 6, minHeight: PAYMENTS_MIN_HEIGHT,
      node: <PaymentsSection profileId={p.id} role={p.role} />,
    } : null,
    [BENTO_IDS.VITALS]: !isGuest ? {
      colSpan: 6, minHeight: VITALS_MIN_HEIGHT,
      node: <VitalsSection profileId={p.id} role={p.role} />,
    } : null,
    [BENTO_IDS.PARTICIPATION]: !isGuest ? {
      colSpan: 6, minHeight: PARTICIPATION_MIN_HEIGHT,
      node: <ParticipationSection profileId={p.id} role={p.role} />,
    } : null,
    [BENTO_IDS.CALENDAR]: {
      colSpan: 6, minHeight: CALENDAR_MIN_HEIGHT,
      node: <CalendarSection profileId={p.id} />,
    },
    [BENTO_IDS.STATS]: p.abo_number ? {
      colSpan: 6, minHeight: STATS_MIN_HEIGHT,
      node: <StatsSection role={p.role} aboNumber={p.abo_number} />,
    } : null,
    [BENTO_IDS.ADMIN]: isAdmin ? {
      colSpan: 6, minHeight: BENTO_HEIGHT.S,
      node: <AdminSection />,
    } : null,
  }

  const orderedBentos = bentoOrder
    .map(id => ({ id, entry: bentoMap[id] ?? null }))
    .filter((b): b is { id: string; entry: BentoEntry } => b.entry !== null)

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">

        <div className="flex justify-end mb-3">
          <button
            onClick={resetLayout}
            className="text-xs font-medium hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('profile.resetLayout')}
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedBentos.map(b => b.id)} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px' }}>
              {orderedBentos.map(({ id, entry }) => (
                <SortableBento
                  key={id}
                  id={id}
                  collapsed={!!bentoCollapsed[id]}
                  onToggleCollapse={() => toggleCollapse(id)}
                  colSpan={entry.colSpan}
                  minHeight={entry.minHeight}
                >
                  {entry.node}
                </SortableBento>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Personal Details Drawer — deferred to SEQ339 */}
      <Drawer open={personalDrawerOpen} onClose={() => { setPersonalDrawerOpen(false); setPersonalErrors({}); savePersonal.reset() }} title={t('profile.tile.personalDetails')}>
        <PersonalDrawerForm
          form={personalForm}
          formErrors={personalErrors}
          onChange={handlePersonalChange}
          onBlur={handlePersonalBlur}
          onClearError={clearPersonalError}
          onCancel={() => { setPersonalDrawerOpen(false); setPersonalErrors({}); savePersonal.reset() }}
          onSave={() => savePersonal.mutate()}
          isPending={savePersonal.isPending}
          isError={savePersonal.isError}
          errorMessage={savePersonal.isError ? (savePersonal.error as Error).message : ''}
          saved={savedPersonal}
        />
      </Drawer>

      {/* Travel Document Drawer — deferred to SEQ339 */}
      <Drawer open={travelDocDrawerOpen} onClose={() => { setTravelDocDrawerOpen(false); setDocErrors({}); saveTravelDoc.reset() }} title={t('profile.tile.travelDoc')}>
        <TravelDocDrawerForm
          form={docForm}
          formErrors={docErrors}
          onDocTypeChange={handleDocTypeChange}
          onDocNumberChange={handleDocNumberChange}
          onValidThroughChange={v => setDocForm(f => ({ ...f, valid_through: v }))}
          onDocNumberBlur={handleDocNumberBlur}
          onValidThroughBlur={handleValidThroughBlur}
          onClearError={clearDocError}
          onCancel={() => { setTravelDocDrawerOpen(false); setDocErrors({}); saveTravelDoc.reset() }}
          onSave={() => saveTravelDoc.mutate()}
          isPending={saveTravelDoc.isPending}
          isError={saveTravelDoc.isError}
          errorMessage={saveTravelDoc.isError ? (saveTravelDoc.error as Error).message : ''}
          saved={savedTravelDoc}
        />
      </Drawer>
    </div>
  )
}
