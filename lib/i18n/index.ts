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

export type Lang = 'en' | 'bg'

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
