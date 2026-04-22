'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/useTheme'
import Logo from '@/components/Logo'
import type { RoadmapDraft, QuoteLineItem } from '@/types'

interface RawProject {
  id: string; slug: string; title: string | null; phase: string
  summary: string | null; created_at: string
  clients:  { name?: string; email?: string; company?: string } | null
  messages: { id: string; role: string; content: string; created_at: string }[]
  roadmaps: {
    ai_draft: RoadmapDraft; final_scope: RoadmapDraft
    timeline_weeks: number | null; admin_notes: string | null; published_at: string | null
  } | null
  quotes: {
    amount: number | null; currency: string
    breakdown: QuoteLineItem[]; valid_until: string | null; published_at: string | null
  } | null
}

const sectionVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07 + 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export default function ClientDashboard({ project }: { project: RawProject }) {
  const { theme, toggle } = useTheme()
  const roadmap     = project.roadmaps
  const quote       = project.quotes
  const isPublished = !!roadmap?.published_at
  const draft       = roadmap?.final_scope ?? roadmap?.ai_draft
  const firstName   = project.clients?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <span className="text-2xs font-mono text-[var(--fg-subtle)] hidden sm:block">{project.slug}</span>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        {/* ── HERO ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 sm:mb-16"
        >
          <p className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-[0.16em] mb-4">Your Roadmap</p>
          <h1 className="text-2xl sm:text-[2rem] font-light text-[var(--fg)] leading-snug mb-3 text-balance">
            {isPublished
              ? `Here's your blueprint, ${firstName}.`
              : `We're reviewing your roadmap, ${firstName}.`}
          </h1>
          {project.summary && (
            <p className="text-sm sm:text-base text-[var(--fg-muted)] leading-[1.85]">{project.summary}</p>
          )}
        </motion.div>

        {/* ── PENDING ── */}
        {!isPublished && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="flex gap-4 p-5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl mb-10"
          >
            <div className="relative w-2 h-2 flex-none mt-1.5">
              <motion.span className="absolute inset-0 rounded-full bg-amber-400"
                animate={{ scale: [1, 2.8, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
              <span className="absolute inset-0 rounded-full bg-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--fg)] mb-1">Under review</p>
              <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-relaxed">
                The Studio Owner is reviewing the AI-generated roadmap to validate complexity and finalise pricing.
                This page updates automatically once your quote is ready.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── PUBLISHED CONTENT ── */}
        {isPublished && draft && (
          <div className="space-y-12 sm:space-y-16">

            {draft.projectSummary && (
              <Sec title="Project Overview" i={0}>
                <p className="text-sm sm:text-base text-[var(--fg-muted)] leading-[1.85]">{draft.projectSummary}</p>
              </Sec>
            )}

            {draft.designSystem && (
              <Sec title="Brand Direction" i={1}>
                <div className="space-y-6">
                  {draft.designSystem.brandPillars?.length > 0 && (
                    <div className="space-y-3.5">
                      {draft.designSystem.brandPillars.map((p, i) => (
                        <div key={i} className="flex gap-4 text-sm sm:text-base text-[var(--fg-muted)] leading-[1.75]">
                          <span className="font-mono text-[var(--fg-subtle)] flex-none tabular-nums pt-px">{String(i + 1).padStart(2, '0')}</span>
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {draft.designSystem.colorDirection      && <InfoCard label="Colour Direction" value={draft.designSystem.colorDirection} />}
                    {draft.designSystem.typographyDirection && <InfoCard label="Typography"        value={draft.designSystem.typographyDirection} />}
                  </div>
                </div>
              </Sec>
            )}

            {draft.technicalStack?.length && (
              <Sec title="Technical Stack" i={2}>
                <div className="flex flex-wrap gap-2">
                  {draft.technicalStack.map((t, i) => (
                    <span key={i} className="text-xs font-mono bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--fg-muted)]">{t}</span>
                  ))}
                </div>
              </Sec>
            )}

            {draft.architecture && (
              <Sec title="Architecture" i={3}>
                <div className="space-y-3">
                  {draft.architecture.databaseSchema && <InfoCard label="Database" value={draft.architecture.databaseSchema} />}
                  {draft.architecture.authModel       && <InfoCard label="Auth Model" value={draft.architecture.authModel} />}
                  {draft.architecture.apiSurface?.length && (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
                      <p className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-widest mb-3">API Surface</p>
                      <div className="space-y-2">
                        {draft.architecture.apiSurface.map((ep, i) => (
                          <p key={i} className="text-xs font-mono text-[var(--fg-muted)] whitespace-nowrap">{ep}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Sec>
            )}

            {(draft.competitorGaps?.length || draft.marketOpportunities?.length) && (
              <Sec title="Market Position" i={4}>
                <div className="space-y-6">
                  {draft.competitorGaps?.length      && <TagCloud label="Competitor Gaps"  items={draft.competitorGaps}      color="emerald" />}
                  {draft.marketOpportunities?.length && <TagCloud label="Opportunities"     items={draft.marketOpportunities} color="purple"  />}
                </div>
              </Sec>
            )}

            {draft.phases?.length && (
              <Sec title="Delivery Phases" i={5}>
                <div className="space-y-7">
                  {draft.phases.map(p => (
                    <div key={p.number} className="flex gap-4">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[var(--border)] flex items-center justify-center flex-none mt-0.5">
                        <span className="text-2xs font-mono text-[var(--fg-subtle)] tabular-nums">{p.number}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2.5 mb-2">
                          <h3 className="text-sm font-medium text-[var(--fg)]">{p.title}</h3>
                          <span className="text-2xs font-mono text-[var(--fg-subtle)]">{p.duration}</span>
                        </div>
                        <ul className="space-y-1.5">
                          {p.deliverables.map((d, i) => (
                            <li key={i} className="flex gap-2.5 text-xs sm:text-sm text-[var(--fg-muted)]">
                              <span className="text-[var(--fg-subtle)] flex-none mt-px">—</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </Sec>
            )}

            <div className="border-t border-[var(--border)]" />

            {/* ── QUOTE ── */}
            {quote?.published_at && (
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="p-5 sm:p-7 bg-[var(--surface)] border border-[var(--border)] rounded-2xl"
              >
                <p className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-[0.15em] mb-7">Project Investment</p>

                {quote.breakdown?.length ? (
                  <div className="space-y-3.5 mb-7">
                    {quote.breakdown.map((item, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-6">
                        <span className="text-sm text-[var(--fg-muted)]">{item.label}</span>
                        <span className="font-mono text-sm text-[var(--fg)] flex-none tabular-nums">
                          {quote.currency} {item.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-[var(--border)] pt-4 flex items-baseline justify-between gap-6">
                      <span className="text-sm font-medium text-[var(--fg)]">Total</span>
                      <span className="text-2xl sm:text-3xl font-mono text-[var(--fg)] tabular-nums">
                        {quote.currency} {quote.amount?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6">
                    <span className="text-3xl sm:text-4xl font-mono text-[var(--fg)] tabular-nums">
                      {quote.currency} {quote.amount?.toLocaleString()}
                    </span>
                  </div>
                )}

                {quote.valid_until && (
                  <p className="text-2xs font-mono text-[var(--fg-subtle)]">
                    Quote valid until{' '}
                    {new Date(quote.valid_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* ── SESSION RECORD ── */}
        {project.messages?.length > 0 && (
          <div className="mt-14 sm:mt-20">
            <p className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-[0.15em] mb-5">
              Session Record — {project.messages.length} messages
            </p>
            <div className="space-y-6 max-h-72 overflow-y-auto pr-1">
              {project.messages.map(m => (
                <div key={m.id}>
                  <span className={cn(
                    'text-2xs font-mono uppercase tracking-widest',
                    m.role === 'user' ? 'text-[var(--fg-subtle)]' : 'text-[var(--fg-muted)]'
                  )}>{m.role}</span>
                  <p className={cn(
                    'text-sm leading-[1.85] mt-0.5 whitespace-pre-wrap',
                    m.role === 'user' ? 'text-[var(--fg-muted)]' : 'text-[var(--fg)]'
                  )}>{m.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

/* ── SUB-COMPONENTS ── */

function Sec({ title, i, children }: { title: string; i: number; children: React.ReactNode }) {
  return (
    <motion.section
      custom={i}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
    >
      <p className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-[0.15em] mb-4 sm:mb-5">{title}</p>
      {children}
    </motion.section>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-widest mb-2">{label}</p>
      <p className="text-sm text-[var(--fg-muted)] leading-[1.75]">{value}</p>
    </div>
  )
}

function TagCloud({ label, items, color }: { label: string; items: string[]; color: 'emerald' | 'purple' }) {
  const cls = color === 'emerald'
    ? 'bg-emerald-950/25 border-emerald-900/40 text-emerald-400'
    : 'bg-purple-950/25 border-purple-900/40 text-purple-400'
  return (
    <div>
      <p className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-widest mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span key={i} className={cn('text-xs border rounded-full px-3 py-1.5', cls)}>{item}</span>
        ))}
      </div>
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="7.5" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 1v1.6M7.5 12.4V14M1 7.5h1.6M12.4 7.5H14M2.93 2.93l1.13 1.13M10.94 10.94l1.13 1.13M2.93 12.07l1.13-1.13M10.94 4.06l1.13-1.13"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M13 9.5A6 6 0 016.5 3a6 6 0 100 9 6 6 0 006.5-2.5z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
