type Props = {
  title: string
  accent?: string
  subtitle?: string
}

export default function PageHeading({ title, accent, subtitle }: Props) {
  const words = title.trim().split(' ')
  const accentWord = accent ?? words[words.length - 1]
  const baseWords = accent
    ? title.replace(new RegExp(`\\s*${accent}$`), '')
    : words.slice(0, -1).join(' ')

  return (
    <div
      className="w-full border-b border-black/5"
      style={{ backgroundColor: 'white' }}
    >
      <div className="max-w-[1024px] mx-auto px-4 md:px-6 lg:px-8 py-8">
        <h1
          className="font-serif text-2xl md:text-3xl font-bold leading-tight tracking-widest uppercase"
          style={{ color: 'var(--deep)' }}
        >
          {baseWords && <>{baseWords} </>}
          <span style={{ color: 'var(--crimson)' }}>{accentWord}</span>
        </h1>
        {subtitle && (
          <p
            className="mt-2 text-xs font-semibold tracking-[0.2em] uppercase"
            style={{ color: 'var(--stone)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
