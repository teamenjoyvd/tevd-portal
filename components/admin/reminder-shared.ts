import type { TranslationKey } from '@/lib/i18n/translations'

const REMINDER_LABEL_LONG_KEYS: Record<string, TranslationKey> = {
  'event_reminder_1h': 'admin.calendar.reminders.type.event_reminder_1h',
  'event_reminder_15m': 'admin.calendar.reminders.type.event_reminder_15m',
  'doc_expiry': 'admin.calendar.reminders.type.doc_expiry',
}

/** i18n'd long-form reminder type label (falls back to the raw type for unknown values). */
export function reminderLabelLong(t: (key: TranslationKey) => string, type: string): string {
  const key = REMINDER_LABEL_LONG_KEYS[type]
  return key ? t(key) : type
}

export const REMINDER_LABEL_SHORT: Record<string, string> = {
  'event_reminder_1h': '1 hr',
  'event_reminder_15m': '15 min',
  'doc_expiry': 'Doc Expiry',
}
