'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { normalizeFormTimes, type EventFormState } from './EventForm'

/**
 * Admin calendar CRUD + sync mutations, extracted from AdminCalendarClient so
 * the component only wires up UI state. All requests go through apiClient
 * (401 interception, consistent error shape) instead of raw fetch.
 */
export function useAdminCalendarMutations() {
  const qc = useQueryClient()

  const syncMutation = useMutation({
    mutationFn: () => apiClient('/api/admin/calendar-sync', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-calendar'] })
      qc.invalidateQueries({ queryKey: ['admin-calendar-sync-status'] })
      setTimeout(() => syncMutation.reset(), 2000)
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['admin-calendar-sync-status'] })
      setTimeout(() => syncMutation.reset(), 2000)
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: EventFormState) =>
      apiClient('/api/admin/calendar', {
        method: 'POST',
        body: JSON.stringify(normalizeFormTimes(body)),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-calendar'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & EventFormState) =>
      apiClient(`/api/admin/calendar/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(normalizeFormTimes(body)),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-calendar'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/api/admin/calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-calendar'] }),
  })

  return { syncMutation, createMutation, updateMutation, deleteMutation }
}
