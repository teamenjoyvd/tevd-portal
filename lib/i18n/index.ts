import { nav }           from './domains/nav'
import { roles }         from './domains/roles'
import { announcements } from './domains/announcements'
import { time }          from './domains/time'
import { guides }        from './domains/guides'
import { notifications } from './domains/notifications'
import { profile }       from './domains/profile'
import { trips }         from './domains/trips'
import { calendar }      from './domains/calendar'
import { events }        from './domains/events'
import { los }           from './domains/los'
import { admin }         from './domains/admin'
import { payment }       from './domains/payment'
import { home }          from './domains/home'
import { about }         from './domains/about'

export type Lang = 'en' | 'bg'

// ---------------------------------------------------------------------------
// Collision guard — throws at module-init time in development and CI so that
// a key added to two domains fails loudly rather than silently overwriting.
// Dead-code-eliminated in production builds (process.env.NODE_ENV === 'production').
// ---------------------------------------------------------------------------
function assertNoDuplicateKeys(
  domains: Record<string, unknown>[],
): void {
  if (process.env.NODE_ENV === 'production') return
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const domain of domains) {
    for (const key of Object.keys(domain)) {
      if (seen.has(key)) dupes.push(key)
      else seen.add(key)
    }
  }
  if (dupes.length > 0) {
    throw new Error(
      `[i18n] Duplicate translation keys detected across domains:\n  ${dupes.join('\n  ')}\n` +
      `Each key must be unique. Rename the conflicting keys to use their domain prefix.`,
    )
  }
}

assertNoDuplicateKeys([
  nav, roles, announcements, time, guides,
  notifications, profile, trips, calendar, events, los, admin, payment, home, about,
])

export const translations = {
  ...nav,
  ...roles,
  ...announcements,
  ...time,
  ...guides,
  ...notifications,
  ...profile,
  ...trips,
  ...calendar,
  ...events,
  ...los,
  ...admin,
  ...payment,
  ...home,
  ...about,
} as const

export type TranslationKey = keyof typeof translations

export function translate(key: TranslationKey, lang: Lang): string {
  return translations[key][lang]
}

// Alias — most callsites use t()
export { translate as t }

// Day and month arrays for calendar — index-based access
export const DAYS_I18N: Record<Lang, string[]> = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  bg: ['Пон', 'Вт',  'Ср',  'Чет', 'Пет', 'Съб', 'Нед'],
}

export const MONTHS_I18N: Record<Lang, string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  bg: ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'],
}
