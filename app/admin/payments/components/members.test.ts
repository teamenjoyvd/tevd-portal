import { describe, expect, it } from 'vitest'
import type { MembersResponse } from '@/lib/types/payments'
import { dedupeMembers } from './members'

describe('dedupeMembers', () => {
  it('returns [] when data is undefined', () => {
    expect(dedupeMembers(undefined)).toEqual([])
  })

  it('merges both halves and sorts by last_name', () => {
    const data: MembersResponse = {
      los_members: [
        { profile: { id: 'p1', first_name: 'Zed', last_name: 'Zephyr', abo_number: '111' } },
      ],
      manual_members_no_abo: [
        { id: 'p2', first_name: 'Amy', last_name: 'Adams', upline_abo_number: null },
      ],
    }

    expect(dedupeMembers(data)).toEqual([
      { id: 'p2', first_name: 'Amy', last_name: 'Adams', abo_number: null },
      { id: 'p1', first_name: 'Zed', last_name: 'Zephyr', abo_number: '111' },
    ])
  })

  it('keeps the ABO-carrying entry when an id appears in both halves', () => {
    const data: MembersResponse = {
      los_members: [
        { profile: { id: 'p1', first_name: 'Jo', last_name: 'Co', abo_number: '999' } },
      ],
      manual_members_no_abo: [
        { id: 'p1', first_name: 'Jo', last_name: 'Co', upline_abo_number: null },
      ],
    }

    expect(dedupeMembers(data)).toEqual([
      { id: 'p1', first_name: 'Jo', last_name: 'Co', abo_number: '999' },
    ])
  })

  it('skips los_members rows with no linked profile', () => {
    const data: MembersResponse = {
      los_members: [{ profile: null }],
      manual_members_no_abo: [],
    }

    expect(dedupeMembers(data)).toEqual([])
  })
})
