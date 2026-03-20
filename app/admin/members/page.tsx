'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Shared types ────────────────────────────────────────────────

// — Members tab —
type LOSMember = {
  abo_number: string
  sponsor_abo_number: string | null
  abo_level: string | null
  name: string | null
  country: string | null
  gpv: number
  ppv: number
  bonus_percent: number
  group_size: number
  annual_ppv: number
  renewal_date: string | null
  profile: {
    id: string
    first_name: string
    last_name: string
    role: string
  } | null
}

type VerificationRequest = {
  id: string
  profile_id: string
  claimed_abo: string
  claimed_upline_abo: string
  status: string
  created_at: string
  profiles: { first_name: string; last_name: string } | null
}

type Guest = {
  id: string
  first_name: string
  last_name: string
  role: string
  created_at: string
}

type MembersData = {
  los_members: LOSMember[]
  pending_verifications: VerificationRequest[]
  unverified_guests: Guest[]
}

// — LOS tab —
type VitalSign = { definition_id: string; recorded_at: string; note: string | null }

type VitalSignDefinition = {
  id: string
  category: string
  label: string | null
  is_active: boolean
  sort_order: number
}

type TreeNode = {
  profile_id: string
  abo_number: string
  name: string | null
  first_name: string
  last_name: string
  role: string
  abo_level: string | null
  depth: number | null
  sponsor_abo_number: string | null
  vital_signs: VitalSign[]
  children?: TreeNode[]
}

type LosTreeResponse = {
  scope: string
  nodes: TreeNode[]
  caller_abo: string | null
}

// — Data Center tab —
type NewMember   = { abo_number: string; name: string; abo_level: string }
type LevelChange = { abo_number: string; name: string; prev_level: string; new_level: string }
type BonusChange = { abo_number: string; name: string; prev_bonus: number; new_bonus: number }

type UnrecognizedRow = {
  abo_number: string
  name: string
  sponsor_abo_number: string | null
}

type ManualMemberNoAbo = {
  id: string
  first_name: string
  last_name: string
  upline_abo_number: string | null
}

type ImportResult = {
  inserted: number
  errors: { abo_number: string; error: string }[]
  diff: {
    new_members:   NewMember[]
    level_changes: LevelChange[]
    bonus_changes: BonusChange[]
  }
  unrecognized: UnrecognizedRow[]
  manual_members_no_abo: ManualMemberNoAbo[]
}

// ── Members tab helpers ────────────────────────────────────────────

function formatNum(n: number) {
  return new Intl.NumberFormat('en-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const LEVEL_BG: Record<string, { bg: string; color: string }> = {
  '1': { bg: 'var(--brand-forest)', color: 'white' },
  '2': { bg: 'var(--brand-crimson)', color: 'white' },
  '3': { bg: 'rgba(0,0,0,0.08)', color: 'var(--text-primary)' },
}

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  member: { bg: '#81b29a33', color: '#2d6a4f' },
  core:   { bg: 'var(--brand-crimson)', color: 'white' },
  admin:  { bg: 'var(--text-primary)', color: 'white' },
  guest:  { bg: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' },
}

// ── LOS tab helpers ───────────────────────────────────────────────

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  admin:  { bg: '#2d332a', color: '#FAF8F3' },
  core:   { bg: '#3E7785', color: '#FAF8F3' },
  member: { bg: 'rgba(62,119,133,0.15)', color: '#3E7785' },
  guest:  { bg: 'rgba(0,0,0,0.06)', color: '#8A8577' },
}

function buildTree(nodes: TreeNode[]): TreeNode[] {
  if (!Array.isArray(nodes)) return []
  const byAbo: Record<string, TreeNode> = {}
  const roots: TreeNode[] = []
  for (const n of nodes) { byAbo[n.abo_number] = { ...n, children: [] } }
  for (const n of Object.values(byAbo)) {
    if (n.sponsor_abo_number && byAbo[n.sponsor_abo_number]) {
      byAbo[n.sponsor_abo_number].children!.push(n)
    } else {
      roots.push(n)
    }
  }
  return roots
}

function NodeCard({
  node, definitions, onToggle, isPending,
}: {
  node: TreeNode
  definitions: VitalSignDefinition[]
  onToggle: (profileId: string, definitionId: string, currentlyRecorded: boolean) => void
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(node.depth !== null ? node.depth < 2 : true)
  const rs = ROLE_STYLES[node.role] ?? ROLE_STYLES.guest
  const hasChildren = (node.children?.length ?? 0) > 0
  const displayName = node.first_name
    ? `${node.first_name} ${node.last_name}`
    : node.name ?? node.abo_number
  const vitalSigns = Array.isArray(node.vital_signs) ? node.vital_signs : []

  return (
    <div className="relative">
      <div className="rounded-xl p-4 mb-1"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-start gap-3">
          {hasChildren ? (
            <button onClick={() => setExpanded(e => !e)}
              className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0 mt-0.5 transition-colors hover:bg-black/10"
              style={{ color: 'var(--text-secondary)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ) : <div className="w-5 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-body text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
              <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: rs.bg, color: rs.color }}>{node.role}</span>
              {node.abo_level && (
                <span className="font-body text-[10px]" style={{ color: 'var(--text-secondary)' }}>{node.abo_level}</span>
              )}
              <span className="font-body text-[10px]" style={{ color: 'var(--text-secondary)' }}>#{node.abo_number}</span>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {definitions.map(def => {
                const checked = vitalSigns.some(v => v.definition_id === def.id)
                const noProfile = !node.profile_id
                return (
                  <label key={def.id}
                    className={`flex items-center gap-1.5 ${noProfile ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer group'}`}
                    title={noProfile ? 'No portal account — cannot track vital signs' : undefined}>
                    <input type="checkbox" checked={checked}
                      disabled={isPending || noProfile}
                      onChange={() => onToggle(node.profile_id!, def.id, checked)}
                      className="w-3.5 h-3.5 rounded accent-[var(--brand-crimson)]" />
                    <span className="text-[11px] font-body transition-colors"
                      style={{ color: checked ? 'var(--brand-crimson)' : 'var(--text-secondary)' }}>
                      {def.label ?? def.category}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            D{node.depth ?? '?'}
          </span>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="ml-6 pl-4 border-l" style={{ borderColor: 'var(--border-default)' }}>
          {node.children!.map(child => (
            <NodeCard key={child.abo_number} node={child} definitions={definitions}
              onToggle={onToggle} isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Data Center tab helpers ───────────────────────────────────────────────

const HEADER_MAP: Record<string, string> = {
  'ABO Level': 'abo_level', 'Sponsor ABO Number': 'sponsor_abo_number',
  'ABO Number': 'abo_number', 'Country': 'country', 'Name': 'name',
  'Entry Date': 'entry_date', 'Phone': 'phone', 'Email': 'email',
  'Address': 'address', 'Renewal Date': 'renewal_date', 'GPV': 'gpv',
  'PPV': 'ppv', 'Bonus Percent': 'bonus_percent', 'GBV': 'gbv',
  'Customer PV': 'customer_pv', 'Ruby PV': 'ruby_pv', 'Customers': 'customers',
  ' Customers': 'customers', 'Points to Next level': 'points_to_next_level',
  'Qualified Legs': 'qualified_legs', 'Group Size': 'group_size',
  'Personal Order Count': 'personal_order_count', 'Group Orders Count': 'group_orders_count',
  'Sponsoring': 'sponsoring', 'Annual PPV': 'annual_ppv',
}

const MONTH_MAP: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
}

function parseDate(val: string): string {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const m = val.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const month = MONTH_MAP[m[2]]
    if (month) return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
  }
  return ''
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const allLines = text.trim().split('\n')
  const headerIdx = allLines.findIndex(l => l.includes('ABO Number'))
  if (headerIdx === -1) return []
  const dataLines = allLines.slice(headerIdx)
  const headers = splitCSVLine(dataLines[0])
  return dataLines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = splitCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        const dbKey = HEADER_MAP[h] ?? h.toLowerCase().replace(/\s+/g, '_')
        let val = values[i] ?? ''
        if (dbKey === 'bonus_percent') val = val.replace('%', '').trim()
        if (dbKey === 'entry_date' || dbKey === 'renewal_date') val = parseDate(val)
        if (dbKey === 'phone') val = val.replace(/^Primary:\s*/i, '').trim()
        row[dbKey] = val
      })
      return row
    })
}

function DiffSection({
  title, count, color, children,
}: { title: string; count: number; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(count <= 5)
  if (count === 0) return null
  return (
    <div className="mt-4">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full text-left">
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: color + '20', color }}>{count}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="ml-auto"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  )
}

function ReconciliationPanel({
  initialUnrecognized, initialProfiles,
}: { initialUnrecognized: UnrecognizedRow[]; initialProfiles: ManualMemberNoAbo[] }) {
  const [unrecognized, setUnrecognized] = useState(initialUnrecognized)
  const [profiles, setProfiles] = useState(initialProfiles)
  const [selectedLos, setSelectedLos] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  if (unrecognized.length === 0 && profiles.length === 0) return null

  const selectedLosRow = unrecognized.find(r => r.abo_number === selectedLos) ?? null

  async function handleLink() {
    if (!selectedProfileId || !selectedLos || !selectedLosRow) return
    setLinking(true)
    setLinkError(null)
    try {
      const res = await fetch(`/api/admin/members/${selectedProfileId}/assign-abo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abo_number: selectedLosRow.abo_number, sponsor_abo_number: selectedLosRow.sponsor_abo_number ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Link failed')
      setUnrecognized(prev => prev.filter(r => r.abo_number !== selectedLos))
      setProfiles(prev => prev.filter(p => p.id !== selectedProfileId))
      setSelectedLos(null)
      setSelectedProfileId(null)
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : 'Link failed')
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="mt-6 p-5 rounded-2xl border" style={{ borderColor: 'rgba(0,0,0,0.07)', backgroundColor: 'white' }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reconciliation</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Match unrecognized LOS members to manually-verified portal profiles.
          </p>
        </div>
        {selectedLos && selectedProfileId && (
          <button onClick={handleLink} disabled={linking}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-teal)' }}>
            {linking ? 'Linking…' : 'Link'}
          </button>
        )}
      </div>
      {linkError && <p className="text-xs mb-3" style={{ color: 'var(--brand-crimson)' }}>{linkError}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            Unrecognized in LOS — {unrecognized.length}
          </p>
          {unrecognized.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>All LOS members matched.</p>
          ) : (
            <div className="space-y-1.5">
              {unrecognized.map(row => (
                <button key={row.abo_number}
                  onClick={() => setSelectedLos(s => s === row.abo_number ? null : row.abo_number)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors"
                  style={{
                    backgroundColor: selectedLos === row.abo_number ? 'rgba(62,119,133,0.15)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${selectedLos === row.abo_number ? '#3E7785' : 'transparent'}`,
                  }}>
                  <span className="font-mono font-medium block" style={{ color: 'var(--text-primary)' }}>{row.abo_number}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.name}</span>
                  {row.sponsor_abo_number && (
                    <span className="block mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>Sponsor {row.sponsor_abo_number}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            No ABO — awaiting position — {profiles.length}
          </p>
          {profiles.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No manually-verified members without ABO.</p>
          ) : (
            <div className="space-y-1.5">
              {profiles.map(p => (
                <button key={p.id}
                  onClick={() => setSelectedProfileId(s => s === p.id ? null : p.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors"
                  style={{
                    backgroundColor: selectedProfileId === p.id ? 'rgba(62,119,133,0.15)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${selectedProfileId === p.id ? '#3E7785' : 'transparent'}`,
                  }}>
                  <span className="font-medium block" style={{ color: 'var(--text-primary)' }}>{p.first_name} {p.last_name}</span>
                  {p.upline_abo_number && (
                    <span style={{ color: 'var(--text-secondary)' }}>Upline {p.upline_abo_number}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Members ────────────────────────────────────────────────────────

function MembersTab() {
  const qc = useQueryClient()
  const [denyNote, setDenyNote] = useState<Record<string, string>>({})
  const [showDenyInput, setShowDenyInput] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery<MembersData>({
    queryKey: ['admin-members-full'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, admin_note }: { id: string; action: 'approve' | 'deny'; admin_note?: string }) =>
      fetch(`/api/admin/members/verify/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, admin_note }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-members-full'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const promoteMutation = useMutation({
    mutationFn: ({ profileId, role }: { profileId: string; role: string }) =>
      fetch(`/api/admin/members/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members-full'] }),
  })

  const losMembers = data?.los_members ?? []
  const pendingVerifications = data?.pending_verifications ?? []
  const unverifiedGuests = data?.unverified_guests ?? []

  return (
    <div className="space-y-8">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {losMembers.length} in LOS · {losMembers.filter(m => m.profile).length} linked to portal accounts
      </p>

      {pendingVerifications.length > 0 && (
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}>
            Pending verification
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {pendingVerifications.length}
            </span>
          </p>
          <div className="space-y-2">
            {pendingVerifications.map(v => {
              const losMatch = losMembers.find(m => m.abo_number === v.claimed_abo)
              const uplineMatch = losMatch?.sponsor_abo_number === v.claimed_upline_abo
              const fullMatch = losMatch && uplineMatch
              return (
                <div key={v.id} className="bg-white rounded-2xl border shadow-sm p-4"
                  style={{ borderColor: fullMatch ? '#81b29a50' : '#f2cc8f80' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {v.profiles?.first_name} {v.profiles?.last_name}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={fullMatch
                            ? { backgroundColor: '#81b29a33', color: '#2d6a4f' }
                            : { backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>
                          {fullMatch ? '✓ LOS match' : losMatch ? '⚠ upline mismatch' : '✗ ABO not in LOS'}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Claims ABO <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{v.claimed_abo}</span>
                        {' · '}upline <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{v.claimed_upline_abo}</span>
                      </p>
                      {losMatch && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          LOS: <span style={{ color: 'var(--text-primary)' }}>{losMatch.name}</span>
                          {' · '}sponsor in LOS: <span style={{ color: uplineMatch ? '#2d6a4f' : 'var(--brand-crimson)' }}>
                            {losMatch.sponsor_abo_number ?? '—'}
                          </span>
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{timeAgo(v.created_at)}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => verifyMutation.mutate({ id: v.id, action: 'approve' })}
                        disabled={verifyMutation.isPending}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--brand-teal)' }}>Approve</button>
                      {!showDenyInput[v.id] ? (
                        <button onClick={() => setShowDenyInput(s => ({ ...s, [v.id]: true }))}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}>Deny</button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <input value={denyNote[v.id] ?? ''}
                            onChange={e => setDenyNote(s => ({ ...s, [v.id]: e.target.value }))}
                            placeholder="Reason (optional)"
                            className="border border-black/10 rounded-lg px-2 py-1 text-xs w-36"
                            style={{ color: 'var(--text-primary)' }} />
                          <button onClick={() => verifyMutation.mutate({ id: v.id, action: 'deny', admin_note: denyNote[v.id] })}
                            disabled={verifyMutation.isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                            style={{ backgroundColor: 'var(--brand-crimson)' }}>Confirm</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {unverifiedGuests.length > 0 && (
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            Guests — no ABO submitted ({unverifiedGuests.length})
          </p>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm divide-y divide-black/5">
            {unverifiedGuests.map(g => (
              <div key={g.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{g.first_name} {g.last_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Joined {timeAgo(g.created_at)}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>guest</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
          LOS map — {losMembers.length} members
        </p>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
            ))}
          </div>
        ) : losMembers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-black/5">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No LOS data. Import a CSV in Data Center.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {losMembers.map((m, i) => {
              const lvl = m.abo_level ?? '?'
              const lc = LEVEL_BG[lvl] ?? LEVEL_BG['3']
              return (
                <div key={m.abo_number} className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <span className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: lc.bg, color: lc.color }}>{lvl}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.name ?? '—'}</p>
                      {m.profile && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={ROLE_BADGE[m.profile.role] ?? ROLE_BADGE.guest}>{m.profile.role}</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {m.abo_number}{m.sponsor_abo_number && ` · ↑ ${m.sponsor_abo_number}`}
                    </p>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    <div className="text-right">
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatNum(m.gpv)}</p>
                      <p>GPV</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold" style={{ color: Number(m.bonus_percent) > 0 ? 'var(--brand-teal)' : 'var(--text-secondary)' }}>{m.bonus_percent}%</p>
                      <p>Bonus</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{m.group_size}</p>
                      <p>Group</p>
                    </div>
                  </div>
                  {m.profile && m.profile.role !== 'admin' && (
                    <div className="flex gap-1 flex-shrink-0">
                      {m.profile.role === 'member' && (
                        <button onClick={() => promoteMutation.mutate({ profileId: m.profile!.id, role: 'core' })}
                          disabled={promoteMutation.isPending}
                          className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: 'var(--brand-crimson)', color: 'white' }}>→ Core</button>
                      )}
                      {m.profile.role === 'core' && (
                        <button onClick={() => promoteMutation.mutate({ profileId: m.profile!.id, role: 'member' })}
                          disabled={promoteMutation.isPending}
                          className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>→ Member</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Tab: LOS Tree ─────────────────────────────────────────────────────

function LosTab() {
  const qc = useQueryClient()

  const { data: treeResponse, isLoading: treeLoading } = useQuery<LosTreeResponse>({
    queryKey: ['los-tree'],
    queryFn: () => fetch('/api/los/tree').then(r => r.json()),
  })

  const { data: definitionsRaw } = useQuery<VitalSignDefinition[]>({
    queryKey: ['vital-sign-definitions'],
    queryFn: () => fetch('/api/admin/vital-sign-definitions').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const flatNodes = Array.isArray(treeResponse?.nodes) ? treeResponse.nodes : []
  const definitions = (Array.isArray(definitionsRaw) ? definitionsRaw : []).filter(d => d.is_active)

  const checkMutation = useMutation({
    mutationFn: ({ profileId, definitionId }: { profileId: string; definitionId: string }) =>
      fetch(`/api/admin/members/${profileId}/vital-signs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition_id: definitionId }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['los-tree'] }),
    onError: (err) => console.error('[vital-signs] check failed:', err),
  })

  const uncheckMutation = useMutation({
    mutationFn: ({ profileId, definitionId }: { profileId: string; definitionId: string }) =>
      fetch(`/api/admin/members/${profileId}/vital-signs/${definitionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['los-tree'] }),
    onError: (err) => console.error('[vital-signs] uncheck failed:', err),
  })

  const isPending = checkMutation.isPending || uncheckMutation.isPending

  function handleToggle(profileId: string, definitionId: string, currentlyRecorded: boolean) {
    if (currentlyRecorded) {
      uncheckMutation.mutate({ profileId, definitionId })
    } else {
      checkMutation.mutate({ profileId, definitionId })
    }
  }

  const treeRoots = buildTree(flatNodes)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Full org tree with vital signs. Click a checkbox to toggle event attendance.
        </p>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{flatNodes.length} members</span>
      </div>

      {definitions.length > 0 && (
        <div className="rounded-xl p-4 flex flex-wrap gap-4"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-crimson)' }}>Vital Signs</span>
          {definitions.map(def => (
            <span key={def.id} className="text-xs font-body" style={{ color: 'var(--text-secondary)' }}>✓ {def.label ?? def.category}</span>
          ))}
        </div>
      )}

      {treeLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : treeRoots.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No LOS data yet.</p>
      ) : (
        <div className="space-y-1">
          {treeRoots.map(node => (
            <NodeCard key={node.abo_number} node={node} definitions={definitions}
              onToggle={handleToggle}
              isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Data Center ───────────────────────────────────────────────────

function DataCenterTab() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [filename, setFilename] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    setResult(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string)
      setPreview(rows.slice(0, 5))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    const text = await file.text()
    const rows = parseCSV(text)
    try {
      const res = await fetch('/api/admin/los-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        LOS CSV import — upserts on ABO number. Rebuilds LTree paths after every import.
      </p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="csv-upload" />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <p className="text-sm font-medium text-gray-700">{filename ? filename : 'Click to select a CSV file'}</p>
          <p className="text-xs text-gray-400 mt-1">{preview.length > 0 ? `${preview.length}+ rows detected` : '.csv only'}</p>
        </label>
      </div>

      {preview.length > 0 && (
        <div className="overflow-x-auto">
          <p className="text-xs text-gray-400 mb-2">Preview (first 5 rows)</p>
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                {Object.keys(preview[0]).map(k => (
                  <th key={k} className="border border-gray-200 px-2 py-1 bg-gray-50 text-left font-medium">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="border border-gray-200 px-2 py-1 truncate max-w-24">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview.length > 0 && (
        <button onClick={handleImport} disabled={loading}
          className="bg-[#bc4749] text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Importing...' : 'Run Import'}
        </button>
      )}

      {result && (
        <div className="p-5 rounded-2xl border" style={{ borderColor: 'rgba(0,0,0,0.07)', backgroundColor: 'white' }}>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Import complete — {result.inserted} rows upserted
            </p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#81b29a20', color: '#2d6a4f' }}>
              {result.diff.new_members.length} new
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#3d405b20', color: '#3d405b' }}>
              {result.diff.level_changes.length} level changes
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e07a5f20', color: '#e07a5f' }}>
              {result.diff.bonus_changes.length} bonus changes
            </span>
          </div>
          <DiffSection title="New members" count={result.diff.new_members.length} color="#81b29a">
            {result.diff.new_members.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#81b29a10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: '#2d6a4f' }}>Level {m.abo_level}</span>
              </div>
            ))}
          </DiffSection>
          <DiffSection title="Level changes" count={result.diff.level_changes.length} color="#3d405b">
            {result.diff.level_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#3d405b10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>{m.prev_level} → {m.new_level}</span>
              </div>
            ))}
          </DiffSection>
          <DiffSection title="Bonus % changes" count={result.diff.bonus_changes.length} color="#e07a5f">
            {result.diff.bonus_changes.map(m => (
              <div key={m.abo_number} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: '#e07a5f10' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{m.abo_number}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                <span className="ml-auto font-semibold" style={{ color: m.new_bonus > m.prev_bonus ? '#2d6a4f' : '#bc4749' }}>
                  {m.prev_bonus}% → {m.new_bonus}%
                </span>
              </div>
            ))}
          </DiffSection>
          {result.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-black/5">
              <p className="text-xs font-semibold text-red-700 mb-1">{result.errors.length} errors:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e.abo_number}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {result && (result.unrecognized.length > 0 || result.manual_members_no_abo.length > 0) && (
        <ReconciliationPanel
          initialUnrecognized={result.unrecognized}
          initialProfiles={result.manual_members_no_abo}
        />
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}

// ── Main page shell ──────────────────────────────────────────────────────

type TabKey = 'members' | 'los' | 'data-center'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'members',     label: 'Members'     },
  { key: 'los',         label: 'LOS Tree'    },
  { key: 'data-center', label: 'Data Center' },
]

export default function AdminMembersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('members')

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Members
      </h1>

      {/* Tab strip */}
      <div className="flex gap-1 mt-4 mb-6 p-1 rounded-xl w-fit" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === tab.key ? 'white' : 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'members'     && <MembersTab />}
      {activeTab === 'los'         && <LosTab />}
      {activeTab === 'data-center' && <DataCenterTab />}
    </div>
  )
}
