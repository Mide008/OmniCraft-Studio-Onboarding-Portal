'use client'

import { motion } from 'framer-motion'

export default function HoldScreen({
  clientName,
  projectSlug,
}: {
  clientName?: string
  projectSlug: string
}) {
  const url       = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/p/${projectSlug}`
  const firstName = clientName?.split(' ')[0]

  return (
    <div className="w-full max-w-[92vw] sm:max-w-md">
      {/* Sender label */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 rounded-md bg-[var(--fg)] flex items-center justify-center flex-none">
          <div className="w-2 h-2 rounded-[3px] bg-[var(--bg)]" />
        </div>
        <span className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-[0.15em]">OmniCraft Studios</span>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="relative w-2 h-2 flex-none">
          <motion.span
            className="absolute inset-0 rounded-full bg-amber-400"
            animate={{ scale: [1, 2.8, 1], opacity: [1, 0, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="absolute inset-0 rounded-full bg-amber-400" />
        </div>
        <span className="text-2xs font-mono text-amber-400 tracking-[0.15em] uppercase">Reviewing complexity</span>
      </div>

      <div className="space-y-3 text-sm sm:text-base leading-[1.85] mb-6">
        <p className="text-[var(--fg)]">
          {firstName ? `Thank you, ${firstName}.` : 'You\'re in.'}{' '}
          Everything we've built here is saved to your private dashboard.
        </p>
        <p className="text-[var(--fg-muted)]">
          The Studio is reviewing the roadmap to validate scope and finalise pricing.
          Expect a response within 24–48 hours.
        </p>
      </div>

      {/* Dashboard card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sm:p-5">
        <p className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-[0.12em] mb-2">Your Dashboard</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-[var(--fg-muted)] break-all hover:text-[var(--fg)] transition-colors duration-150"
        >
          {url}
        </a>
        <p className="text-2xs text-[var(--fg-subtle)] mt-3">
          Bookmark this. Your roadmap and quote will appear here once published.
        </p>
      </div>
    </div>
  )
}
