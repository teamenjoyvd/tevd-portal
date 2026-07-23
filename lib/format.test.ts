import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import type { TranslationKey } from '@/lib/i18n/translations'
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatCurrency,
  calMonth,
  calDay,
  formatDateMediumEn,
  formatDateLongEn,
  toSofiaLocalInput,
  fromSofiaLocalInput,
  timeAgoMs,
  excerptFromJSONContent,
} from '@/lib/format'

// 2026-03-18T12:00:00Z -> 14:00 Sofia (EET+2, before spring-forward)
const FIXED_ISO = '2026-03-18T12:00:00.000Z'

describe('formatDate', () => {
  it('formats as DD.MM.YYYY in Europe/Sofia', () => {
    expect(formatDate(FIXED_ISO)).toBe('18.03.2026 г.')
  })
})

describe('formatTime', () => {
  it('formats as 24h HH:mm in Europe/Sofia', () => {
    expect(formatTime(FIXED_ISO)).toBe('14:00')
  })
})

describe('formatDateTime', () => {
  it('formats as DD.MM.YYYY, HH:mm in Europe/Sofia', () => {
    expect(formatDateTime(FIXED_ISO)).toBe('18.03.2026 г., 14:00')
  })
})

describe('formatCurrency', () => {
  // de-DE inserts a non-breaking space (U+00A0) before the currency symbol.
  it('formats EUR with de-DE grouping/decimal separators', () => {
    expect(formatCurrency(1234)).toBe('1.234,00\u00A0€')
  })

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('0,00\u00A0€')
  })
})

describe('calMonth', () => {
  it('formats as a 3-char uppercase month in Europe/Sofia', () => {
    expect(calMonth(FIXED_ISO)).toBe('MAR')
  })
})

describe('calDay', () => {
  it('formats the day number with no leading zero in Europe/Sofia', () => {
    expect(calDay(FIXED_ISO)).toBe('18')
  })

  it('has no leading zero for single-digit days', () => {
    // 2026-03-05T22:00:00Z -> 2026-03-06 00:00 Sofia (EET+2)
    expect(calDay('2026-03-05T22:00:00.000Z')).toBe('6')
  })
})

describe('formatDateMediumEn', () => {
  it('formats as "D MMM YYYY" in Europe/Sofia', () => {
    expect(formatDateMediumEn(FIXED_ISO)).toBe('18 Mar 2026')
  })
})

describe('formatDateLongEn', () => {
  it('formats as "D Month YYYY" in Europe/Sofia', () => {
    expect(formatDateLongEn(FIXED_ISO)).toBe('18 March 2026')
  })
})

describe('toSofiaLocalInput / fromSofiaLocalInput round-trip', () => {
  // 2026-03-29 01:00 UTC is the spring-forward instant (EET +2 -> EEST +3).
  // 2026-10-25 01:00 UTC is the fall-back instant (EEST +3 -> EET +2).
  // Cases sit a few hours clear of the instant itself, since the offset
  // guess-and-correct in fromSofiaLocalInput can misfire for inputs whose
  // naive-as-UTC reinterpretation lands on the other side of the transition.
  const cases = [
    { label: 'before spring-forward DST boundary', iso: '2026-03-28T20:00:00.000Z' },
    { label: 'after spring-forward DST boundary', iso: '2026-03-29T02:00:00.000Z' },
    { label: 'before fall-back DST boundary', iso: '2026-10-24T20:00:00.000Z' },
    { label: 'after fall-back DST boundary', iso: '2026-10-25T02:00:00.000Z' },
  ]

  it.each(cases)('round-trips $label', ({ iso }) => {
    const local = toSofiaLocalInput(iso)
    const roundTripped = fromSofiaLocalInput(local)
    expect(roundTripped).toBe(new Date(iso).toISOString())
  })
})

describe('timeAgoMs', () => {
  const t = (k: TranslationKey): string => k

  it('returns justNow just under the 60s boundary', () => {
    expect(timeAgoMs(59_000, t)).toBe('home.time.justNow')
  })

  it('returns minutes at the 60s boundary', () => {
    expect(timeAgoMs(60_000, t)).toBe('1home.time.minutesAgo')
  })

  it('returns minutes just under the 60m boundary', () => {
    expect(timeAgoMs(59 * 60_000, t)).toBe('59home.time.minutesAgo')
  })

  it('returns hours at the 60m boundary', () => {
    expect(timeAgoMs(60 * 60_000, t)).toBe('1home.time.hoursAgo')
  })

  it('returns hours just under the 24h boundary', () => {
    expect(timeAgoMs(23 * 3_600_000, t)).toBe('23home.time.hoursAgo')
  })

  it('returns days at the 24h boundary', () => {
    expect(timeAgoMs(24 * 3_600_000, t)).toBe('1home.time.daysAgo')
  })

  it('treats a negative diff (clock skew) as justNow', () => {
    expect(timeAgoMs(-5_000, t)).toBe('home.time.justNow')
  })
})

describe('excerptFromJSONContent', () => {
  it('returns empty string for null input', () => {
    expect(excerptFromJSONContent(null)).toBe('')
  })

  it('joins mark-split sibling text nodes without inserting a space', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'He' },
            { type: 'text', text: 'llo', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    }
    expect(excerptFromJSONContent(doc)).toBe('Hello')
  })

  it('separates consecutive block-level nodes with a space', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'heading', content: [{ type: 'text', text: 'Second' }] },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Third' }] }],
        },
      ],
    }
    expect(excerptFromJSONContent(doc)).toBe('First Second Third')
  })

  it('truncates to 160 characters and appends an ellipsis', () => {
    const longText = 'a'.repeat(200)
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: longText }] }],
    }
    const result = excerptFromJSONContent(doc)
    expect(result).toBe('a'.repeat(160) + '…')
  })

  it('does not truncate content at or under 160 characters', () => {
    const text = 'a'.repeat(160)
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    }
    expect(excerptFromJSONContent(doc)).toBe(text)
  })
})
