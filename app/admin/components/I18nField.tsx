'use client'

// Shared primitive: i18n text input or textarea for the active language.
// Used by AnnouncementsTab (create + edit).

type I18nFieldProps = {
  activeLang: string
  values: Record<string, string>
  onChange: (lang: string, value: string) => void
  multiline?: boolean
  placeholder?: string
  rows?: number
}

export function I18nField({
  activeLang,
  values,
  onChange,
  multiline = false,
  placeholder,
  rows = 4,
}: I18nFieldProps) {
  const value = values[activeLang] ?? ''
  const sharedStyle = {
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-card)',
  }
  const sharedClass = 'w-full border rounded-xl px-3 py-2.5 text-sm'
  // eslint-disable-next-line i18next/no-literal-string
  // reason: admin-internal format string, not UI copy for translation
  const placeholderText = placeholder ? `${placeholder} (${activeLang.toUpperCase()})` : undefined

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(activeLang, e.target.value)}
        placeholder={placeholderText}
        rows={rows}
        className={`${sharedClass} resize-none`}
        style={sharedStyle}
      />
    )
  }

  return (
    <input
      value={value}
      onChange={e => onChange(activeLang, e.target.value)}
      placeholder={placeholderText}
      className={sharedClass}
      style={sharedStyle}
    />
  )
}
