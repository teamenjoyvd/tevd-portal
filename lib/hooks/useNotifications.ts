import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type Notification = {
  id: string
  profile_id: string
  is_read: boolean
  type: 'role_request' | 'trip_request' | 'trip_created' | 'event_fetched' | 'doc_expiry' | 'los_digest'
  title: string
  message: string
  action_url: string | null
  created_at: string
  deleted_at: string | null
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then(r => r.json()),
    refetchInterval: 15_000,
  })
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => fetch('/api/notifications?count=true').then(r => r.json()),
    refetchInterval: 15_000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      }).then(r => r.json()),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] })
      const prev = qc.getQueryData<Notification[]>(['notifications'])
      qc.setQueryData<Notification[]>(['notifications'], old =>
        old?.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      qc.setQueryData<{ count: number }>(['notifications', 'unread-count'], old =>
        old ? { count: Math.max(0, old.count - 1) } : { count: 0 }
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => fetch('/api/notifications/read-all', { method: 'POST' }).then(r => r.json()),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] })
      const prev = qc.getQueryData<Notification[]>(['notifications'])
      qc.setQueryData<Notification[]>(['notifications'], old =>
        old?.map(n => ({ ...n, is_read: true }))
      )
      qc.setQueryData<{ count: number }>(['notifications', 'unread-count'], { count: 0 })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_at: new Date().toISOString() }),
      }).then(r => r.json()),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] })
      const prev = qc.getQueryData<Notification[]>(['notifications'])
      const deleted = prev?.find(n => n.id === id)
      qc.setQueryData<Notification[]>(['notifications'], old =>
        old?.filter(n => n.id !== id)
      )
      if (deleted && !deleted.is_read) {
        qc.setQueryData<{ count: number }>(['notifications', 'unread-count'], old =>
          old ? { count: Math.max(0, old.count - 1) } : { count: 0 }
        )
      }
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useClearAllNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      }).then(r => r.json()),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] })
      const prev = qc.getQueryData<Notification[]>(['notifications'])
      qc.setQueryData<Notification[]>(['notifications'], [])
      qc.setQueryData<{ count: number }>(['notifications', 'unread-count'], { count: 0 })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
