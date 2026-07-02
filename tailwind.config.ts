import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-fg': 'rgb(var(--brand-fg) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      borderRadius: { lg: '0.6rem', xl: '0.9rem', '2xl': '1.15rem' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(38 30 24 / 0.04), 0 6px 16px -8px rgb(38 30 24 / 0.10)',
        pop: '0 8px 30px -12px rgb(38 30 24 / 0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config
