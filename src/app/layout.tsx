import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: "OmniCraft Studios — Let's build your roadmap.",
  description: 'A zero-handoff AI-driven client onboarding portal. From idea to technical roadmap — before the first meeting.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
  userScalable: false, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#080808' },
    { media: '(prefers-color-scheme: light)', color: '#F4F2EC' },
  ],
}

const THEME_SCRIPT = `!function(){try{var t=localStorage.getItem('oc-theme'),p=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t||p)}catch(e){}}();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans font-feature" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
