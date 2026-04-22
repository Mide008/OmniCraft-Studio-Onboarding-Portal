'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/useTheme'
import Logo from '@/components/Logo'
import type { RoadmapDraft, QuoteLineItem } from '@/types'

interface AdminProject {
  id: string; slug: string; title: string | null; phase: string; status: string
  summary: string | null; createdAt: string
  client:   { name?: string; email?: string; phone?: string; company?: string } | null
  messages: { id: string; role: string; content: string; timestamp: string }[]
  roadmap:  { adminNotes?: string; timelineWeeks?: number; publishedAt?: string; aiDraft?: RoadmapDraft } | null
  quote:    { amount?: number; currency?: string; publishedAt?: string } | null
}

const STATUS: Record<string, string> = {
  draft:          'text-[var(--fg-3)]   border-[var(--stroke)]',
  pending_review: 'text-amber-400       border-amber-800/60',
  reviewed:       'text-blue-400        border-blue-800/60',
  published:      'text-emerald-400     border-emerald-800/60',
}

const EASE = [0.22, 1, 0.36, 1]

export default function AdminPage() {
  const { theme, toggle, mounted } = useTheme()
  const [projects,     setProjects]     = useState<AdminProject[]>([])
  const [selected,     setSelected]     = useState<AdminProject | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [adminKey,     setAdminKey]     = useState('')
  const [authed,       setAuthed]       = useState(false)
  const [authError,    setAuthError]    = useState('')
  const [mobileDetail, setMobileDetail] = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/projects')
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!authed) return
    load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [authed, load])

  /* ── Auth gate ── */
  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-5"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full max-w-sm"
        >
          {mounted && (
            <div className="flex items-center gap-2.5 mb-12">
              <Logo theme={theme} />
              <span className="text-2xs font-mono tracking-[0.22em] uppercase text-[var(--fg-2)]">
                Studio Admin
              </span>
            </div>
          )}
          <form onSubmit={e => {
            e.preventDefault()
            if (adminKey.length >= 8) { setAuthed(true); setAuthError('') }
            else setAuthError('Key must be at least 8 characters.')
          }} className="space-y-4">
            <div>
              <label className="block text-2xs font-mono text-[var(--fg-2)] uppercase tracking-widest mb-2">
                Admin Key
              </label>
              <input
                type="password" value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="Enter your admin key" autoFocus
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)]
                           rounded-xl px-4 text-sm text-[var(--fg)]
                           placeholder:text-[var(--fg-3)] focus:outline-none
                           focus:border-[var(--stroke-strong)]
                           focus:shadow-[0_0_0_3px_var(--input-ring)]
                           min-h-[52px] text-[16px] sm:text-[14px] transition-all"
              />
              {authError && (
                <p className="text-2xs text-red-400 mt-2 font-mono">{authError}</p>
              )}
            </div>
            <button type="submit"
              className="w-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium
                         rounded-xl min-h-[52px] hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Enter Studio
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  /* ── Main layout ── */
  return (
    <div className="bg-[var(--bg)] text-[var(--fg)] flex flex-col"
      style={{ height: '100dvh', overflow: 'hidden' }}
    >
      {/* Header */}
      <header className="flex-none flex items-center justify-between
                         px-4 sm:px-6 h-14 sm:h-16
                         border-b border-[var(--stroke)]
                         bg-[var(--bg)]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          {mounted && <Logo theme={theme} size="sm" />}
          <span className="text-2xs font-mono tracking-[0.22em] uppercase text-[var(--fg-2)]">
            Admin
          </span>
          <span className="text-2xs font-mono text-[var(--fg-3)] ml-1.5">
            · {projects.length} session{projects.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {mobileDetail && selected && (
            <button onClick={() => setMobileDetail(false)}
              className="sm:hidden text-2xs font-mono text-[var(--fg-2)]
                         px-3 py-1.5 border border-[var(--stroke)] rounded-lg"
            >
              ← All
            </button>
          )}
          {mounted && (
            <button onClick={toggle} aria-label="Toggle theme"
              className="w-9 h-9 rounded-xl flex items-center justify-center
                         text-[var(--fg-2)] hover:text-[var(--fg)]
                         hover:bg-[var(--surface-mid)] transition-colors"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar */}
        <aside className={cn(
          'flex-none border-r border-[var(--stroke)] flex flex-col overflow-hidden',
          'w-full sm:w-72',
          mobileDetail ? 'hidden sm:flex' : 'flex'
        )}>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <motion.div
                  className="w-5 h-5 rounded-full
                             border-[1.5px] border-[var(--stroke-strong)] border-t-[var(--fg-2)]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            ) : projects.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-[var(--fg-2)] text-sm">No sessions yet.</p>
                <p className="text-[var(--fg-3)] text-xs mt-1 leading-relaxed">
                  They appear here as clients begin onboarding.
                </p>
              </div>
            ) : (
              <ul>
                {projects.map((p, i) => (
                  <motion.li key={p.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.035, duration: 0.3, ease: EASE }}
                  >
                    <button
                      onClick={() => { setSelected(p); setMobileDetail(true) }}
                      className={cn(
                        'w-full text-left px-4 sm:px-5 py-4',
                        'border-b border-[var(--stroke)] transition-colors',
                        'hover:bg-[var(--surface-mid)]',
                        selected?.id === p.id && 'bg-[var(--surface)]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-sm text-[var(--fg)] font-medium truncate leading-snug">
                          {p.title ?? p.client?.email ?? `Session ${p.slug.slice(0, 6)}`}
                        </span>
                        <span className={cn(
                          'text-2xs font-mono border rounded px-1.5 py-0.5 flex-none whitespace-nowrap',
                          STATUS[p.status] ?? 'text-[var(--fg-3)] border-[var(--stroke)]'
                        )}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-2xs text-[var(--fg-3)] font-mono">
                        <span className="capitalize">{p.phase}</span>
                        <span>·</span>
                        <span>
                          {new Date(p.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short',
                          })}
                        </span>
                        {p.messages?.length > 0 && (
                          <><span>·</span><span>{p.messages.length} msgs</span></>
                        )}
                      </div>
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Detail */}
        <main className={cn(
          'flex-1 overflow-y-auto',
          mobileDetail ? 'block' : 'hidden sm:block'
        )}>
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="hidden sm:flex items-center justify-center h-full"
              >
                <p className="text-[var(--fg-3)] text-sm">Select a session to review</p>
              </motion.div>
            ) : (
              <motion.div key={selected.id}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <ProjectDetail
                  project={selected} adminKey={adminKey}
                  onUpdated={u => { setSelected(u); setProjects(p => p.map(x => x.id === u.id ? u : x)) }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

/* ── Project detail ── */
function ProjectDetail({
  project, adminKey, onUpdated,
}: {
  project: AdminProject; adminKey: string; onUpdated: (p: AdminProject) => void
}) {
  const [adminNotes,    setAdminNotes]    = useState(project.roadmap?.adminNotes ?? '')
  const [timelineWeeks, setTimelineWeeks] = useState(project.roadmap?.timelineWeeks?.toString() ?? '')
  const [quoteAmount,   setQuoteAmount]   = useState(project.quote?.amount?.toString() ?? '')
  const [currency,      setCurrency]      = useState(project.quote?.currency ?? 'USD')
  const [lineItems,     setLineItems]     = useState<QuoteLineItem[]>([])
  const [pushing,       setPushing]       = useState(false)
  const [pushed,        setPushed]        = useState(!!project.roadmap?.publishedAt)
  const [pushError,     setPushError]     = useState('')
  const [tab,           setTab]           = useState<'conversation' | 'roadmap' | 'quote'>('conversation')

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const dashboardUrl = `${appUrl}/p/${project.slug}`

  const handlePush = async () => {
    if (pushing || pushed) return
    setPushing(true); setPushError('')
    try {
      const res = await fetch('/api/admin/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId:     project.id, adminKey,
          adminNotes:    adminNotes || undefined,
          quoteAmount:   quoteAmount ? parseFloat(quoteAmount) : undefined,
          quoteCurrency: currency,
          breakdown:     lineItems.filter(i => i.label.trim() && i.amount > 0),
          timelineWeeks: timelineWeeks ? parseInt(timelineWeeks) : undefined,
          validUntilDays: 14,
        }),
      })
      if (!res.ok) { const { error: msg } = await res.json(); setPushError(msg ?? 'Push failed'); return }
      setPushed(true)
      onUpdated({ ...project, status: 'published', phase: 'reveal' })
    } catch { setPushError('Network error. Try again.') }
    finally { setPushing(false) }
  }

  const inputCls = `w-full bg-[var(--input-bg)] border border-[var(--input-border)]
    rounded-xl px-4 py-3 text-sm text-[var(--fg)]
    placeholder:text-[var(--fg-3)] focus:outline-none
    focus:border-[var(--stroke-strong)] transition-all`

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-10">

      {/* Session header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-2xs font-mono text-[var(--fg-3)] tracking-widest mb-1">
              {project.slug}
            </p>
            <h2 className="text-xl sm:text-2xl text-[var(--fg)] font-light">
              {project.title ?? project.client?.email ?? 'Unnamed Session'}
            </h2>
          </div>
          <span className={cn(
            'text-2xs font-mono border rounded-full px-3 py-1 flex-none',
            STATUS[project.status] ?? 'text-[var(--fg-3)] border-[var(--stroke)]'
          )}>
            {project.status.replace('_', ' ')}
          </span>
        </div>

        {project.client && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fg-2)] mt-2">
            {project.client.name    && <span>{project.client.name}</span>}
            {project.client.company && <><span className="text-[var(--fg-3)]">·</span><span>{project.client.company}</span></>}
            {project.client.email   && <><span className="text-[var(--fg-3)]">·</span><span>{project.client.email}</span></>}
            {project.client.phone   && <><span className="text-[var(--fg-3)]">·</span><span>{project.client.phone}</span></>}
          </div>
        )}

        <a href={dashboardUrl} target="_blank" rel="noopener noreferrer"
          className="text-2xs font-mono text-[var(--fg-3)] hover:text-[var(--fg-2)]
                     mt-2 inline-block break-all transition-colors"
        >
          {dashboardUrl} ↗
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--stroke)] mb-7 overflow-x-auto">
        {(['conversation', 'roadmap', 'quote'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              'px-3 sm:px-4 py-2.5 text-2xs font-mono uppercase tracking-widest',
              'border-b-2 -mb-px whitespace-nowrap transition-colors',
              tab === t
                ? 'text-[var(--fg)] border-[var(--fg)]'
                : 'text-[var(--fg-3)] border-transparent hover:text-[var(--fg-2)]'
            )}
          >
            {t}
            {t === 'conversation' && project.messages?.length > 0 && ` (${project.messages.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Conversation */}
      {tab === 'conversation' && (
        <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
          {!project.messages?.length ? (
            <p className="text-[var(--fg-3)] text-sm">No messages yet.</p>
          ) : project.messages.map(m => (
            <div key={m.id}>
              <span className="text-2xs font-mono text-[var(--fg-3)] uppercase tracking-widest">
                {m.role}
              </span>
              <p className={cn(
                'text-sm leading-[1.8] mt-1 whitespace-pre-wrap',
                m.role === 'user' ? 'text-[var(--fg-2)]' : 'text-[var(--fg)]'
              )}>
                {m.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Roadmap */}
      {tab === 'roadmap' && (
        <div className="space-y-5">
          {project.roadmap?.aiDraft?.projectSummary && (
            <div className="bg-[var(--surface)] border border-[var(--stroke)] rounded-xl p-4 sm:p-5">
              <p className="text-2xs font-mono text-[var(--fg-3)] uppercase tracking-widest mb-2">
                AI Summary
              </p>
              <p className="text-sm text-[var(--fg-2)] leading-[1.7]">
                {project.roadmap.aiDraft.projectSummary}
              </p>
            </div>
          )}
          <div>
            <label className="block text-2xs font-mono text-[var(--fg-2)] uppercase tracking-widest mb-2">
              Review Notes
            </label>
            <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
              placeholder="Complexity flags, scope adjustments, pricing rationale..."
              rows={4}
              className={cn(inputCls, 'resize-none')}
            />
          </div>
          <div>
            <label className="block text-2xs font-mono text-[var(--fg-2)] uppercase tracking-widest mb-2">
              Timeline (weeks)
            </label>
            <input type="number" value={timelineWeeks}
              onChange={e => setTimelineWeeks(e.target.value)} placeholder="12"
              className="w-28 bg-[var(--input-bg)] border border-[var(--input-border)]
                         rounded-lg px-4 py-2.5 text-sm text-[var(--fg)]
                         focus:outline-none focus:border-[var(--stroke-strong)] transition-all"
            />
          </div>
        </div>
      )}

      {/* Tab: Quote */}
      {tab === 'quote' && (
        <div className="space-y-5">
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-2xs font-mono text-[var(--fg-2)] uppercase tracking-widest mb-2">
                Currency
              </label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="bg-[var(--input-bg)] border border-[var(--input-border)]
                           rounded-lg px-3 py-3 text-sm text-[var(--fg)]
                           focus:outline-none focus:border-[var(--stroke-strong)] transition-all"
              >
                {['USD','EUR','GBP','NGN','CAD','AUD'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-2xs font-mono text-[var(--fg-2)] uppercase tracking-widest mb-2">
                Total Amount
              </label>
              <input type="number" value={quoteAmount}
                onChange={e => setQuoteAmount(e.target.value)} placeholder="15000"
                className={inputCls}
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-2xs font-mono text-[var(--fg-2)] uppercase tracking-widest">
                Breakdown
              </label>
              <button
                onClick={() => setLineItems(p => [...p, { label: '', amount: 0 }])}
                className="text-2xs font-mono text-[var(--fg-3)] hover:text-[var(--fg-2)] transition-colors"
              >
                + Add line
              </button>
            </div>
            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={item.label}
                    onChange={e => setLineItems(p => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                    placeholder="Brand Identity"
                    className="flex-1 bg-[var(--input-bg)] border border-[var(--input-border)]
                               rounded-lg px-3 py-2.5 text-sm text-[var(--fg)]
                               placeholder:text-[var(--fg-3)]
                               focus:outline-none focus:border-[var(--stroke-strong)] transition-all"
                  />
                  <input type="number" value={item.amount || ''}
                    onChange={e => setLineItems(p => p.map((x, idx) => idx === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                    placeholder="5000"
                    className="w-24 bg-[var(--input-bg)] border border-[var(--input-border)]
                               rounded-lg px-3 py-2.5 text-sm text-[var(--fg)]
                               focus:outline-none focus:border-[var(--stroke-strong)] transition-all"
                  />
                  <button
                    onClick={() => setLineItems(p => p.filter((_, idx) => idx !== i))}
                    className="text-[var(--fg-3)] hover:text-[var(--fg-2)] text-lg px-1 transition-colors leading-none"
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Push CTA */}
      <div className="mt-10 pt-8 border-t border-[var(--stroke)]">
        {pushError && (
          <p className="text-2xs text-red-400 font-mono mb-4">{pushError}</p>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--fg)] font-medium">Push to client</p>
            <p className="text-xs text-[var(--fg-3)] mt-0.5">
              Publishes roadmap + quote to{' '}
              <span className="font-mono">/p/{project.slug}</span>
            </p>
          </div>
          <motion.button
            onClick={handlePush}
            disabled={pushing || pushed}
            whileTap={!pushing && !pushed ? { scale: 0.96 } : undefined}
            className={cn(
              'px-6 rounded-xl text-sm font-medium transition-all',
              'min-h-[48px] w-full sm:w-auto flex-none',
              pushed
                ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/50 cursor-default'
                : pushing
                ? 'bg-[var(--surface)] border border-[var(--stroke)] text-[var(--fg-2)] cursor-wait'
                : 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 active:scale-[0.98]'
            )}
          >
            {pushed ? '✓ Published' : pushing ? 'Publishing…' : 'Push to Client →'}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="7.5" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7.5 1v1.6M7.5 12.4V14M1 7.5h1.6M12.4 7.5H14M3.05 3.05l1.13 1.13M10.82 10.82l1.13 1.13M3.05 11.95l1.13-1.13M10.82 4.18l1.13-1.13"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M13 9.5A6 6 0 016 2.5a6 6 0 100 10A6 6 0 0013 9.5z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
      />
    </svg>
  )
}
