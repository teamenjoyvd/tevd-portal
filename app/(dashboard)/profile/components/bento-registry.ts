import { type TranslationKey } from '@/lib/i18n/translations'

// ── Bento ids ─────────────────────────────────────────────────────────────────

export const BENTO_IDS = {
  PERSONAL_DETAILS: 'personal-details',
  ABO_INFO:         'abo-info',
  TRAVEL_DOC:       'travel-doc',
  SETTINGS:         'settings',
  TRIPS:            'trips',
  PAYMENTS:         'payments',
  EMAIL_PREFS:      'email_prefs',
  VITALS:           'vitals',
  PARTICIPATION:    'participation',
  CALENDAR:         'calendar',
  STATS:            'stats',
  ADMIN:            'admin',
  INVITES:          'invites',
} as const

export const DEFAULT_ORDER: string[] = [
  BENTO_IDS.PERSONAL_DETAILS,
  BENTO_IDS.ABO_INFO,
  BENTO_IDS.TRAVEL_DOC,
  BENTO_IDS.CALENDAR,
  BENTO_IDS.PARTICIPATION,
  BENTO_IDS.VITALS,
  BENTO_IDS.TRIPS,
  BENTO_IDS.PAYMENTS,
  BENTO_IDS.SETTINGS,
  BENTO_IDS.EMAIL_PREFS,
  BENTO_IDS.STATS,
  BENTO_IDS.INVITES,
  BENTO_IDS.ADMIN,
]

// ── Bento id → i18n key map ───────────────────────────────────────────────────

export const BENTO_KEY_MAP: Record<string, TranslationKey> = {
  [BENTO_IDS.PERSONAL_DETAILS]: 'profile.bento.personalDetails',
  [BENTO_IDS.ABO_INFO]:         'profile.bento.aboInfo',
  [BENTO_IDS.TRAVEL_DOC]:       'profile.bento.travelDoc',
  [BENTO_IDS.SETTINGS]:         'profile.bento.settings',
  [BENTO_IDS.TRIPS]:            'profile.bento.trips',
  [BENTO_IDS.PAYMENTS]:         'profile.bento.payments',
  [BENTO_IDS.EMAIL_PREFS]:      'profile.bento.emailPrefs',
  [BENTO_IDS.VITALS]:           'profile.bento.vitals',
  [BENTO_IDS.PARTICIPATION]:    'profile.bento.participation',
  [BENTO_IDS.CALENDAR]:         'profile.bento.calendar',
  [BENTO_IDS.STATS]:            'profile.bento.stats',
  [BENTO_IDS.ADMIN]:            'profile.bento.admin',
  [BENTO_IDS.INVITES]:          'profile.bento.invites',
}
