import { describe, expect, it } from 'vitest'
import { buildEventDescription } from '@/lib/server/calendar'

describe('buildEventDescription', () => {
  it('returns undefined when no description or detail fields are set', () => {
    expect(
      buildEventDescription({ description: null, location: null, meeting_url: null, category: null }),
    ).toMatchInlineSnapshot(`undefined`)
  })

  it('returns just the base description when no detail fields are set', () => {
    expect(
      buildEventDescription({
        description: 'Monthly N21 meetup',
        location: null,
        meeting_url: null,
        category: null,
      }),
    ).toMatchInlineSnapshot(`"Monthly N21 meetup"`)
  })

  it('returns just the detail lines when there is no base description', () => {
    expect(
      buildEventDescription({
        description: null,
        location: 'Sofia HQ',
        meeting_url: 'https://meet.example.com/abc',
        category: 'N21',
      }),
    ).toMatchInlineSnapshot(`
      "Location: Sofia HQ
      Meeting link: https://meet.example.com/abc
      Category: N21"
    `)
  })

  it('joins the base description and detail lines with a blank line (Phase 1c format)', () => {
    expect(
      buildEventDescription({
        description: 'Monthly N21 meetup',
        location: 'Sofia HQ',
        meeting_url: 'https://meet.example.com/abc',
        category: 'N21',
      }),
    ).toMatchInlineSnapshot(`
      "Monthly N21 meetup

      Location: Sofia HQ
      Meeting link: https://meet.example.com/abc
      Category: N21"
    `)
  })

  it('omits a detail line whose field is an empty string', () => {
    expect(
      buildEventDescription({
        description: 'Monthly N21 meetup',
        location: '',
        meeting_url: 'https://meet.example.com/abc',
        category: null,
      }),
    ).toMatchInlineSnapshot(`
      "Monthly N21 meetup

      Meeting link: https://meet.example.com/abc"
    `)
  })

  it('omits the category line when category is an empty string', () => {
    expect(
      buildEventDescription({
        description: 'Monthly N21 meetup',
        location: null,
        meeting_url: null,
        category: '',
      }),
    ).toMatchInlineSnapshot(`"Monthly N21 meetup"`)
  })
})
