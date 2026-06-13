'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/useTheme'
import Logo from '@/components/Logo'
import type { RoadmapDraft, QuoteLineItem } from '@/types'

interface Project {
  id: string
  slug: string
  title: string | null
  phase: string
  summary: string | null
  created_at: string
  clients: { name?: string; email?: string; company?: string } | null
  messages: { id: string; role: string; content: string; created_at: string }[]
  roadmaps: {
    ai_draft: RoadmapDraft
    final_scope: RoadmapDraft
    timeline_weeks: number | null
    admin_notes: string | null
    published_at: string | null
  } | null
  quotes: {
    amount: number | null
    currency: string
    breakdown: QuoteLineItem[]
    valid_until: string | null
    published_at: string | null
  } | null
}
const E = [0.22, 1, 0.36, 1] as const
const STEPS = [
  { key: 'hold', label: 'Brief Submitted' },
  { key: 'pending_review', label: 'Under Review' },
  { key: 'reveal', label: 'Roadmap Ready' },
]

export default function ClientDashboard({ project }: { project: Project }) {
  const { theme, toggle, mounted } = useTheme()
  const rm = project.roadmaps,
    quote = project.quotes
  const isPublished = !!rm?.published_at
  const draft = rm?.final_scope ?? rm?.ai_draft
  const first = project.clients?.name?.split(' ')[0] ?? 'there'
  const [fu, setFu] = useState('')
  const [fuSent, setFuSent] = useState(false)
  const [fuLoading, setFuLoading] = useState(false)
  const [fuErr, setFuErr] = useState('')
  const stepIdx = STEPS.findIndex(s => s.key === project.phase)
  const cur = stepIdx === -1 ? 0 : stepIdx

  const sendFu = async () => {
    if (!fu.trim() || fuLoading) return
    setFuLoading(true)
    setFuErr('')
    try {
      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: project.slug,
          message: fu,
          clientName: project.clients?.name,
          clientEmail: project.clients?.email,
        }),
      })
      if (!res.ok) throw new Error()
      setFuSent(true)
      setFu('')
    } catch {
      setFuErr('Could not send. Please try again.')
    } finally {
      setFuLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--str)] bg-[var(--bg)]/90 backdrop-blur-xl px-4 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {mounted && <Logo theme={theme} size="sm" />}
          <span className="text-2xs font-mono tracking-[.22em] uppercase text-[var(--fg2)]">OmniCraft Studios</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xs font-mono text-[var(--fg3)] hidden sm:block">{project.slug}</span>
          {mounted && (
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--fg2)] hover:text-[var(--fg)] hover:bg-[var(--mid)] transition-colors"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-14">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: E }}>
          <p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest mb-4">Your Roadmap</p>
          <h1 className="text-3xl sm:text-4xl font-light text-[var(--fg)] leading-tight mb-3">
            {isPublished ? `Here's your blueprint, ${first}.` : `We're reviewing your roadmap, ${first}.`}
          </h1>
          {project.summary && <p className="text-[var(--fg2)] leading-[1.85] text-[15px]">{project.summary}</p>}
        </motion.div>

        {/* Status timeline */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest mb-5">Project Status</p>
          <div className="flex items-center">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center mb-2 transition-all',
                      i < cur
                        ? 'bg-emerald-500 border-emerald-500'
                        : i === cur
                        ? 'bg-[var(--fg)] border-[var(--fg)]'
                        : 'bg-transparent border-[var(--str)]'
                    )}
                  >
                    {i < cur ? (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className={cn('block w-2 h-2 rounded-full', i === cur ? 'bg-[var(--bg)]' : 'bg-transparent')} />
                    )}
                  </div>
                  <span className={cn('text-2xs font-mono text-center leading-tight px-1', i <= cur ? 'text-[var(--fg2)]' : 'text-[var(--fg3)]')}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className={cn('h-0.5 flex-1 mx-1 mb-6 transition-all', i < cur ? 'bg-emerald-500' : 'bg-[var(--str)]')} />}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Under review notice */}
        {!isPublished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex gap-4 p-5 bg-[var(--surf)] border border-[var(--str)] rounded-2xl">
            <span className="relative flex h-2 w-2 flex-none mt-1.5">
              <motion.span
                className="absolute inset-0 rounded-full bg-amber-400"
                animate={{ scale: [1, 2.8, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              />
              <span className="relative block h-full w-full rounded-full bg-amber-400" />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--fg)] mb-1">Under review</p>
              <p className="text-xs text-[var(--fg2)] leading-relaxed">
                The Studio Owner is reviewing the AI-generated roadmap to validate complexity and finalise pricing. This page updates automatically — typically within 24–48 hours.
              </p>
            </div>
          </motion.div>
        )}

        {/* Published roadmap */}
        {isPublished && draft && (
          <>
            {draft.projectSummary && <S title="Project Overview" i={0}><p className="text-[var(--fg2)] leading-[1.85] text-sm">{draft.projectSummary}</p></S>}
            {draft.technicalStack && draft.technicalStack.length > 0 && (
              <S title="Technical Stack" i={1}>
                <div className="flex flex-wrap gap-2">
                  {draft.technicalStack.map((t: string, i: number) => (
                    <span key={i} className="text-xs font-mono bg-[var(--surf)] border border-[var(--str)] rounded-lg px-3 py-1.5 text-[var(--fg2)]">
                      {t}
                    </span>
                  ))}
                </div>
              </S>
            )}
            {draft.phases && draft.phases.length > 0 && (
              <S title="Delivery Phases" i={2}>
                <div className="space-y-6">
                  {draft.phases.map((p: any) => (
                    <div key={p.number} className="flex gap-4">
                      <div className="w-7 h-7 rounded-full border border-[var(--str)] flex items-center justify-center flex-none mt-0.5">
                        <span className="text-2xs font-mono text-[var(--fg3)]">{p.number}</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                          <h3 className="text-sm font-medium text-[var(--fg)]">{p.title}</h3>
                          <span className="text-2xs font-mono text-[var(--fg3)]">{p.duration}</span>
                        </div>
                        <ul className="space-y-1">
                          {p.deliverables?.map((d: string, i: number) => (
                            <li key={i} className="flex gap-2 text-xs text-[var(--fg2)]">
                              <span className="text-[var(--fg3)] flex-none">—</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </S>
            )}
            {(draft.competitorGaps?.length || draft.marketOpportunities?.length) && (
              <S title="Market Position" i={3}>
                <div className="space-y-5">
                  {draft.competitorGaps && draft.competitorGaps.length > 0 && (
                    <Tags label="Competitor Gaps" items={draft.competitorGaps} color="emerald" />
                  )}
                  {draft.marketOpportunities && draft.marketOpportunities.length > 0 && (
                    <Tags label="Opportunities" items={draft.marketOpportunities} color="purple" />
                  )}
                </div>
              </S>
            )}
            <div className="border-t border-[var(--str)]" />
            {quote?.published_at && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.55, ease: E }}
                className="p-5 sm:p-8 bg-[var(--surf)] border border-[var(--str)] rounded-2xl"
              >
                <p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest mb-7">Project Investment</p>
                {quote.breakdown && quote.breakdown.length > 0 ? (
                  <div className="space-y-3 mb-7">
                    {quote.breakdown.map((item: QuoteLineItem, i: number) => (
                      <div key={i} className="flex justify-between items-baseline gap-4 text-sm">
                        <span className="text-[var(--fg2)]">{item.label}</span>
                        <span className="font-mono text-[var(--fg)] flex-none tabular-nums">
                          {quote.currency} {item.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-[var(--str)] pt-3 flex justify-between items-baseline">
                      <span className="text-sm text-[var(--fg2)]">Total</span>
                      <span className="text-2xl sm:text-3xl font-mono text-[var(--fg)] tabular-nums">
                        {quote.currency} {quote.amount?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-5">
                    <span className="text-3xl sm:text-4xl font-mono text-[var(--fg)] tabular-nums">
                      {quote.currency} {quote.amount?.toLocaleString()}
                    </span>
                  </div>
                )}
                {quote.valid_until && (
                  <p className="text-2xs font-mono text-[var(--fg3)]">
                    Quote valid until {new Date(quote.valid_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                <p className="text-xs text-[var(--fg3)] mt-3 leading-relaxed">
                  To accept this quote, reply to your confirmation email or send a follow-up message below.
                </p>
              </motion.div>
            )}
          </>
        )}

        {/* Follow-up */}
        <S title="Send a Message to the Studio" i={99}>
          {fuSent ? (
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-3">
              <p className="text-sm text-emerald-300">✓ Message sent. The Studio will be in touch shortly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[var(--fg3)] leading-relaxed">Have a question, update, or something to add? Send a note directly to the Studio.</p>
              <textarea
                value={fu}
                onChange={e => setFu(e.target.value)}
                placeholder="Something you'd like to add or ask…"
                rows={3}
                className="w-full bg-[var(--in-bg)] border border-[var(--in-str)] rounded-xl px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg3)] focus:outline-none focus:border-[var(--strS)] focus:shadow-[0_0_0_3px_var(--in-ring)] resize-none transition-all"
                style={{ fontSize: '16px' }}
              />
              {fuErr && <p className="text-2xs text-red-400 font-mono">{fuErr}</p>}
              <button
                onClick={sendFu}
                disabled={!fu.trim() || fuLoading}
                className={cn(
                  'w-full rounded-xl text-sm font-medium min-h-[48px] transition-all',
                  !fu.trim() || fuLoading
                    ? 'bg-[var(--mid)] text-[var(--fg3)] cursor-not-allowed'
                    : 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 active:scale-[.98]'
                )}
              >
                {fuLoading ? 'Sending…' : 'Send to Studio →'}
              </button>
            </div>
          )}
        </S>

        {/* Session record */}
        {project.messages?.length > 0 && (
          <S title={`Discovery Session — ${project.messages.length} messages`} i={100}>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {project.messages.map(m => (
                <div key={m.id}>
                  <span className={cn('text-2xs font-mono uppercase tracking-widest', m.role === 'user' ? 'text-[var(--fg3)]' : 'text-[var(--fg2)]')}>
                    {m.role}
                  </span>
                  <p className={cn('text-sm leading-[1.8] mt-0.5 whitespace-pre-wrap', m.role === 'user' ? 'text-[var(--fg2)]' : 'text-[var(--fg)]')}>
                    {m.content}
                  </p>
                </div>
              ))}
            </div>
          </S>
        )}
      </main>
    </div>
  )
}

function S({ title, i, children }: { title: string; i: number; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + i * 0.05, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest mb-4 sm:mb-5">{title}</p>
      {children}
    </motion.section>
  )
}
function Tags({ label, items, color }: { label: string; items: string[]; color: 'emerald' | 'purple' }) {
  const cls =
    color === 'emerald'
      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
      : 'bg-purple-950/30 border-purple-800/40 text-purple-300'
  return (
    <div>
      <p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((t: string, i: number) => (
          <span key={i} className={cn('text-xs border rounded-full px-3 py-1', cls)}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
function Sun() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 1v1.6M7.5 12.4V14M1 7.5h1.6M12.4 7.5H14M3.05 3.05l1.13 1.13M10.82 10.82l1.13 1.13M3.05 11.95l1.13-1.13M10.82 4.18l1.13-1.13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
function Moon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M13 9.5A6 6 0 016 2.5a6 6 0 100 10A6 6 0 0013 9.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}