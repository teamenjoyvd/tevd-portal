/**
 * Re-export shim — translations.ts has been split into lib/i18n/domains/*
 * All exports are forwarded from lib/i18n/index.ts.
 * Callers importing from 'lib/i18n/translations' continue to work unchanged.
 * Remove this shim once all imports have been updated to 'lib/i18n'.
 */
export {
  translations,
  translate,
  translate as t,
  DAYS_I18N,
  MONTHS_I18N,
} from './index'

export type { Lang, TranslationKey } from './index'
