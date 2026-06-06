import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pgf: {
          50:  '#EEF1FB',
          100: '#C5CDF0',
          200: '#9BAAE6',
          400: '#5A6FCC',
          500: '#3D52B0',
          600: '#2B3A8E',
          700: '#1E2B6B',
          800: '#141E4A',
          900: '#0D163A',
          950: '#080E25',
        },
        dark: {
          bg:      '#09152A',
          surface: '#0F1E3A',
          card:    '#132244',
          border:  'rgba(255,255,255,0.08)',
          hover:   '#192B52',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
