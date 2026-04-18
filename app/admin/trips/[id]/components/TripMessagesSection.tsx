'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDateTime } from '@/lib/format'

// ── Types ────────────────────────────────────────────────────────

type Message = {
  id: string
  body: string
  created_at: string
  updated_at: string
}

// ── Module-scope form components (CLAUDE.md hard rule) ───────────

function PostForm({
  tripId,
  onSuccess,
}: {
  tripId: string
  onSuccess: () => void
}) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin/trips/${tripId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      setBody('')
      setError(null)
      onSuccess()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write a message\u2026"
        rows={3}
        className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2"
        style={{
          backgroundColor: 'var(--bg-global)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          // @ts-expect-error css var
          '--tw-ring-color': 'var(--brand-crimson)',
        }}
      />
      {error && <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !body.trim()}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ backgroundColor: 'var(--brand-crimson)' }}
      >
        {mutation.isPending ? 'Posting\u2026' : 'Post'}
      </button>
    </div>
  )
}

function EditForm({
  tripId,
  message,
  onSuccess,
  onCancel,
}: {
  tripId: string
  message: Message
  onSuccess: () => void
  onCancel: () => void
}) {
  const [body, setBody] = useState(message.body)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin/trips/${tripId}/messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      setError(null)
      onSuccess()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="space-y-2 mt-1">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2"
        style={{
          backgroundColor: 'var(--bg-global)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          // @ts-expect-error css var
          '--tw-ring-color': 'var(--brand-crimson)',
        }}
      />
      {error && <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !body.trim() || body.trim() === message.body}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {mutation.isPending ? 'Saving\u2026' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export function TripMessagesSection({ tripId }: { tripId: string }) {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null)

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['trip-messages-admin', tripId],
    queryFn: () =>
      fetch(`/api/admin/trips/${tripId}/messages`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const r = await fetch(`/api/admin/trips/${tripId}/messages/${messageId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to delete')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trip-messages-admin', tripId] }),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['trip-messages-admin', tripId] })
  }

  return (
    <section
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Messages
      </h2>

      <PostForm tripId={tripId} onSuccess={invalidate} />

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No messages yet.</p>
      ) : (
        <ul className="space-y-3">
          {messages.map(msg => (
            <li
              key={msg.id}
              className="rounded-lg px-4 py-3 space-y-1"
              style={{ backgroundColor: 'var(--bg-global)', border: '1px solid var(--border-default)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formatDateTime(msg.created_at)}
                  {msg.updated_at !== msg.created_at && ' (edited)'}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditingId(editingId === msg.id ? null : msg.id)}
                    className="hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Edit message"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: msg.id })}
                    className="hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--brand-crimson)' }}
                    aria-label="Delete message"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {editingId === msg.id ? (
                <EditForm
                  tripId={tripId}
                  message={msg}
                  onSuccess={() => { setEditingId(null); invalidate() }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                  {msg.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
