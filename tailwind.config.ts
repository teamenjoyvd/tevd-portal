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
      },
    },
  },
  plugins: [],
}

export default config