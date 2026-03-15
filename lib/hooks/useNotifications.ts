import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type Notification = {
  id: string
  profile_id: string
  is_read: boolean
  type: 'role_request' | 'trip_request' | 'trip_created' | 'event_fetched' | 'doc_expiry'
  title: string
  message: string
  action_url: string | null
  created_at: string
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
      fetch(`/api/notifications/${id}`, { method: 'PATCH' }).then(r => r.json()),
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