import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surf)', 'surface-mid': 'var(--mid)', 'surface-high': 'var(--hi)',
        stroke: 'var(--str)', 'stroke-strong': 'var(--strS)',
        fg: 'var(--fg)', 'fg-2': 'var(--fg2)', 'fg-3': 'var(--fg3)',
        accent: 'var(--acc)',
      },
      fontFamily: { sans: ['var(--font-geist-sans)','system-ui','sans-serif'], mono: ['var(--font-geist-mono)','monospace'] },
      fontSize: { '2xs': ['0.625rem', { lineHeight: '1rem', letterSpacing: '0.06em' }] },
      maxWidth: { chat: '660px' },
      keyframes: {
        'in-up':   { from: { opacity:'0', transform:'translateY(10px)' }, to: { opacity:'1', transform:'translateY(0)' } },
        'cursor':  { '0%,100%': { opacity:'1' }, '50%': { opacity:'0' } },
        'dot':     { '0%,100%': { opacity:'.2' }, '50%': { opacity:'1' } },
        'pdot':    { '0%,100%': { transform:'scale(1)', opacity:'.9' }, '50%': { transform:'scale(2.6)', opacity:'0' } },
        'rspin':   { to: { transform:'rotate(360deg)' } },
      },
      animation: {
        'in-up':  'in-up 0.42s cubic-bezier(.22,1,.36,1) both',
        'cursor': 'cursor 0.9s step-end infinite',
        'dot':    'dot 1.1s ease-in-out infinite',
        'pdot':   'pdot 2.2s ease-in-out infinite',
        'rspin':  'rspin 0.75s linear infinite',
      },
    },
  },
  plugins: [],
}
export default config
