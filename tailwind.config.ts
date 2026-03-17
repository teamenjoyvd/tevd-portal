import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['var(--font-montserrat)', 'sans-serif'],
        serif: ['var(--font-playfair)', 'serif'],
        display: ['var(--font-cormorant)', 'serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        eggshell: '#f4f1de',
        forest:   '#2d332a',
        deep:     '#3d405b',
        crimson:  '#bc4749',
        sienna:   '#e07a5f',
        stone:    '#8e8b82',
        sage:     '#81b29a',
        sandy:    '#f2cc8f',
        brand: {
          forest:    '#2d332a',
          crimson:   '#bc4749',
          teal:      '#3E7785',
          parchment: '#F2EFE8',
          void:      '#1A1F18',
          oyster:    '#E8E4DC',
          moss:      '#252B23',
          stone:     '#8A8577',
        }
      },
    },
  },
  plugins: [],
}

export default config