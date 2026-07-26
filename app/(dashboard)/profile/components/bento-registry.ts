import {
  User,
  IdCard,
  Plane,
  Settings,
  Luggage,
  CreditCard,
  Mail,
  HeartPulse,
  Users,
  Calendar,
  BarChart3,
  Shield,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
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

// ── Layout metadata ───────────────────────────────────────────────────────────

export const BENTO_HEIGHT = { S: 160, M: 280 } as const

type BentoHeightTier = keyof typeof BENTO_HEIGHT

export const BENTO_META: Record<string, { colSpan: number; height: BentoHeightTier }> = {
  [BENTO_IDS.PERSONAL_DETAILS]: { colSpan: 6, height: 'M' },
  [BENTO_IDS.ABO_INFO]:         { colSpan: 6, height: 'M' },
  [BENTO_IDS.TRAVEL_DOC]:       { colSpan: 6, height: 'S' },
  [BENTO_IDS.SETTINGS]:         { colSpan: 6, height: 'M' },
  [BENTO_IDS.TRIPS]:            { colSpan: 6, height: 'M' },
  [BENTO_IDS.PAYMENTS]:         { colSpan: 6, height: 'M' },
  [BENTO_IDS.EMAIL_PREFS]:      { colSpan: 6, height: 'M' },
  [BENTO_IDS.VITALS]:           { colSpan: 6, height: 'M' },
  [BENTO_IDS.PARTICIPATION]:    { colSpan: 6, height: 'M' },
  [BENTO_IDS.CALENDAR]:         { colSpan: 6, height: 'S' },
  [BENTO_IDS.STATS]:            { colSpan: 6, height: 'S' },
  [BENTO_IDS.ADMIN]:            { colSpan: 6, height: 'S' },
  [BENTO_IDS.INVITES]:          { colSpan: 6, height: 'M' },
}

// ── Bento id → icon map — also used by the collapsed bar ─────────────────────

export const BENTO_ICON_MAP: Record<string, LucideIcon> = {
  [BENTO_IDS.PERSONAL_DETAILS]: User,
  [BENTO_IDS.ABO_INFO]:         IdCard,
  [BENTO_IDS.TRAVEL_DOC]:       Plane,
  [BENTO_IDS.SETTINGS]:         Settings,
  [BENTO_IDS.TRIPS]:            Luggage,
  [BENTO_IDS.PAYMENTS]:         CreditCard,
  [BENTO_IDS.EMAIL_PREFS]:      Mail,
  [BENTO_IDS.VITALS]:           HeartPulse,
  [BENTO_IDS.PARTICIPATION]:    Users,
  [BENTO_IDS.CALENDAR]:         Calendar,
  [BENTO_IDS.STATS]:            BarChart3,
  [BENTO_IDS.ADMIN]:            Shield,
  [BENTO_IDS.INVITES]:          UserPlus,
}
