'use client'

/**
 * Thin re-export — useLanguage delegates to the LangProvider context.
 * Public API (lang, toggle, t) is unchanged; all callsites require zero edits.
 *
 * Previous implementation used useSyncExternalStore + document.cookie which:
 *   - always returned 'en' from getServerSnapshot, causing a hydration flash for BG users
 *   - relied on a window event bus for cross-component updates
 *
 * LangProvider in app/(dashboard)/layout.tsx resolves the correct lang server-side
 * from the tevd_lang cookie and passes it as initialLang, fixing the SSR mismatch.
 * All consumers update synchronously via React state — no window events needed.
 */
export { useLang as useLanguage } from '@/lib/context/LangProvider'
