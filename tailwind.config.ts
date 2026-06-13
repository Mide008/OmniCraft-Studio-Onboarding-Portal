import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: { bg:'var(--bg)',surface:'var(--surf)','surface-mid':'var(--mid)',stroke:'var(--str)','stroke-strong':'var(--strS)',fg:'var(--fg)','fg-2':'var(--fg2)','fg-3':'var(--fg3)',accent:'var(--acc)' },
      fontFamily: { sans:['var(--font-geist-sans)','system-ui','sans-serif'], mono:['var(--font-geist-mono)','monospace'] },
      fontSize: { '2xs':['0.625rem',{lineHeight:'1rem',letterSpacing:'0.06em'}] },
      maxWidth: { chat:'660px' },
    },
  },
  plugins: [],
}
export default config
