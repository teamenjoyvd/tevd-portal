'use client'

import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Drawer } from '@/components/ui/drawer'
import { apiClient, ApiError } from '@/lib/apiClient'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n'

export type TicketActionSpec = {
  /** Under /api/admin/tickets/. */
  path: string
  label: TranslationKey
  /** A confirmation is shown first. */
  confirm?: string
  input?: { label: TranslationKey; type: 'text' | 'email' | 'date'; body: (value: string) => object }
}
type Result = {
  emailed?: boolean
  zoomCancelled?: boolean
  registered?: boolean
  zoomFailed?: number
  online?: boolean
}

export const INPUT_CLASS = 'w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm'
export const INPUT_STYLE = { borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }
export const SMALL_BUTTON = 'px-3 py-2 rounded-xl border text-sm font-semibold disabled:opacity-40'
export const SMALL_STYLE = { ...INPUT_STYLE, minHeight: 44 }
export const TICKETS_KEY = 'admin-tickets'

const ERRORS: Record<string, TranslationKey> = {
  attempts_used: 'admin.tickets.err.attempts_used',
  started: 'admin.tickets.err.started',
  busy: 'admin.tickets.err.busy',
  zoom_failed: 'admin.tickets.err.zoom_failed',
  not_later: 'admin.tickets.err.not_later',
  no_email: 'admin.tickets.err.no_email',
  invalid_input: 'tickets.door.invalid',
  void: 'admin.tickets.err.changed',
  revoked: 'admin.tickets.err.changed',
  cancelled: 'admin.tickets.err.changed',
  not_found: 'admin.tickets.err.changed',
  not_pending: 'admin.tickets.err.changed',
  not_online: 'admin.tickets.err.changed',
  nothing_to_cancel: 'admin.tickets.err.changed',
}

export function resultKey(r: Result): TranslationKey {
  if (r.zoomCancelled === false || r.registered === false || (r.zoomFailed ?? 0) > 0) return 'admin.tickets.doneNoZoom'
  if (r.emailed === false) return 'admin.tickets.doneNoEmail'
  if (r.online) return 'admin.tickets.doneRemove'
  return 'admin.tickets.done'
}

/** A button, its form or confirmation, and what came of it. */
export function TicketAction({ spec, disabled = false, hint }: { spec: TicketActionSpec; disabled?: boolean; hint?: string }) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const run = useMutation({
    mutationFn: () =>
      apiClient<Result>(`/api/admin/tickets/${spec.path}`, {
        method: 'POST',
        body: JSON.stringify(spec.input?.body(value) ?? {}),
      }),
  })
  // The list reloads on closing, so the result stays readable until then.
  const close = () => {
    if (run.isPending) return
    setOpen(false)
    setValue('')
    if (run.isSuccess || run.isError) qc.invalidateQueries({ queryKey: [TICKETS_KEY] })
    run.reset()
  }
  const ready = spec.input === undefined || value.trim() !== ''
  const submit = () => {
    if (ready && !run.isPending && !run.isSuccess) run.mutate()
  }
  const code = run.error instanceof ApiError ? run.error.code : undefined

  const body: ReactNode = (
    <form
      id={`form-${spec.path}`}
      className="space-y-4 pb-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {spec.input !== undefined && !run.isSuccess && (
        <input
          aria-label={t(spec.input.label)}
          placeholder={t(spec.input.label)}
          type={spec.input.type}
          required
          maxLength={320}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={INPUT_CLASS}
          style={INPUT_STYLE}
        />
      )}
      {run.isError && (
        <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>
          {t((code !== undefined ? ERRORS[code] : undefined) ?? 'tickets.err.failed')}
        </p>
      )}
      {run.isSuccess && <p className="text-sm" role="status" style={{ color: 'var(--text-primary)' }}>{t(resultKey(run.data))}</p>}
    </form>
  )
  const confirmButton = !run.isSuccess && (
    <button
      type="submit"
      form={`form-${spec.path}`}
      disabled={!ready || run.isPending}
      className="px-6 py-2.5 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40"
      style={{ backgroundColor: 'var(--brand-crimson)', minHeight: 44 }}
    >
      {t('admin.tickets.confirm')}
    </button>
  )

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={SMALL_BUTTON} style={SMALL_STYLE}>
        {t(spec.label)}
        {disabled && hint !== undefined ? ` (${hint})` : ''}
      </button>
      {spec.confirm !== undefined ? (
        <AlertDialog open={open} onOpenChange={(o) => { if (!o) close() }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(spec.label)}</AlertDialogTitle>
              <AlertDialogDescription>{spec.confirm}</AlertDialogDescription>
            </AlertDialogHeader>
            {body}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={run.isPending}>
                {run.isSuccess ? t('admin.tickets.close') : t('admin.tickets.comp.cancel')}
              </AlertDialogCancel>
              {confirmButton}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Drawer open={open} onClose={close} title={t(spec.label)}>
          <div className="space-y-4 pb-4">
            {body}
            {confirmButton}
          </div>
        </Drawer>
      )}
    </>
  )
}
