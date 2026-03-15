type Props = {
  title: string
  accent?: string   // last word highlighted in crimson — if omitted, auto-splits last word
  subtitle?: string
}

export default function PageHeading({ title, accent, subtitle }: Props) {
  // If no explicit accent, split last word automatically
  const words = title.trim().split(' ')
  const accentWord = accent ?? words[words.length - 1]
  const baseWords = accent
    ? title.replace(new RegExp(`\\s*${accent}$`), '')
    : words.slice(0, -1).join(' ')

  return (
    <div className="pt-6 pb-8">
      <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight tracking-tight"
        style={{ color: 'var(--deep)' }}>
        {baseWords && <>{baseWords} </>}
        <span style={{ color: 'var(--crimson)' }}>{accentWord}</span>
      </h1>
      {subtitle && (
        <p className="mt-2 text-xs font-semibold tracking-[0.2em] uppercase"
          style={{ color: 'var(--stone)' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}