'use client'
import { useState, useRef, useEffect, useCallback, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Message, AgentMode, UploadedFile, GateFormData, ProjectPhase } from '@/types'
import { useTheme } from '@/lib/useTheme'
import Logo from '@/components/Logo'
import { cn, detectAssetType, formatFileSize, MAX_FILE_SIZE_BYTES, ALL_ACCEPTED_TYPES } from '@/lib/utils'

const E = [0.22, 1, 0.36, 1]
const GATE_TRIGGER = 4

const WELCOME: Message = {
  id: 'welcome', role: 'assistant', timestamp: new Date(), mode: 'creative',
  content: `Let's build your roadmap.\n\nTell me about your project — what you're building, the problem it solves, or the feeling you want it to evoke.\n\nDescribe it any way that feels natural. A rough instinct is enough to start.`,
}

const MODE_CONFIG: Record<AgentMode, { label: string; dot: string; bg: string; border: string; text: string }> = {
  creative:    { label: 'Creative',    dot: '#A855F7', bg: 'rgba(168,85,247,.10)', border: 'rgba(168,85,247,.3)', text: '#C084FC' },
  engineering: { label: 'Engineering', dot: '#3B82F6', bg: 'rgba(59,130,246,.10)',  border: 'rgba(59,130,246,.3)',  text: '#60A5FA' },
  research:    { label: 'Research',    dot: '#10B981', bg: 'rgba(16,185,129,.10)',  border: 'rgba(16,185,129,.3)',  text: '#34D399' },
}

export default function OnboardingPortal() {
  const { theme, toggle, mounted } = useTheme()
  const [messages,    setMessages]    = useState<Message[]>([])
  const [input,       setInput]       = useState('')
  const [streaming,   setStreaming]   = useState(false)
  const [modes,       setModes]       = useState<AgentMode[]>(['creative'])
  const [projectId,   setProjectId]   = useState<string | null>(null)
  const [projectSlug, setProjectSlug] = useState<string | null>(null)
  const [phase,       setPhase]       = useState<ProjectPhase>('discovery')
  const [ready,       setReady]       = useState(false)
  const [clientName,  setClientName]  = useState<string | undefined>()
  const [files,       setFiles]       = useState<UploadedFile[]>([])
  const [, startT]                    = useTransition()

  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const gatedRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => { setMessages([WELCOME]); setReady(true) }, 480)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, phase])

  const resize = useCallback(() => {
    const el = inputRef.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])
  useEffect(() => { resize() }, [input, resize])

  useEffect(() => {
    if (gatedRef.current || streaming || phase !== 'discovery') return
    const done = messages.filter(m => m.role === 'assistant' && m.id !== 'welcome' && m.content.length > 60).length
    if (done >= GATE_TRIGGER) {
      gatedRef.current = true; setPhase('synthesis')
      setMessages(p => [...p, {
        id: `bridge-${Date.now()}`, role: 'assistant', timestamp: new Date(), mode: 'creative',
        content: `I now have a clear picture of what you're building.\n\nBefore I finalise the roadmap, let me save everything we've discussed and route it to the Studio for final scoping and pricing.\n\nJust your details below — 30 seconds.`,
      }])
      setTimeout(() => setPhase('gate'), 2000)
    }
  }, [messages, streaming, phase])

  const uploadFile = useCallback(async (f: UploadedFile, pid: string) => {
    setFiles(p => p.map(x => x.id === f.id ? { ...x, status: 'uploading' } : x))
    try {
      const fd = new FormData(); fd.append('file', f.file); fd.append('projectId', pid)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const { assetId, url } = await res.json()
      setFiles(p => p.map(x => x.id === f.id ? { ...x, status: 'done', assetId } : x))
      if (f.type === 'audio') {
        const af = new FormData(); af.append('file', f.file); af.append('assetId', assetId)
        fetch('/api/transcribe', { method: 'POST', body: af }).then(r => r.json())
          .then(({ transcription }) => { if (transcription) fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId, projectId: pid, type: 'audio', url, transcription }) }).catch(() => {}) })
          .catch(() => {})
      } else { fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId, projectId: pid, type: f.type, url }) }).catch(() => {}) }
    } catch { setFiles(p => p.map(x => x.id === f.id ? { ...x, status: 'error' } : x)) }
  }, [])

  const send = useCallback(async (content: string) => {
    if (!content.trim() || streaming || phase !== 'discovery') return
    const text = content.trim(), aid = `ai-${Date.now()}`
    startT(() => { setMessages(p => [...p, { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: new Date() }, { id: aid, role: 'assistant', content: '', timestamp: new Date() }]); setInput(''); setStreaming(true) })
    try {
      abortRef.current = new AbortController()
      const history = messages.filter(m => m.role !== 'system').slice(-12).map(m => ({ role: m.role as 'user'|'assistant', content: m.content }))
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, projectId, messages: history }), signal: abortRef.current.signal })
      if (!res.ok || !res.body) throw new Error(`${res.status}`)
      const newPid = res.headers.get('X-Project-Id'), newModes = res.headers.get('X-Detected-Modes')
      if (newPid && !projectId) {
        setProjectId(newPid)
        fetch(`/api/project?id=${newPid}`).then(r => r.json()).then(d => d.slug && setProjectSlug(d.slug)).catch(() => {})
        files.filter(f => f.status === 'pending').forEach(f => uploadFile(f, newPid))
      } else if (projectId) { files.filter(f => f.status === 'pending').forEach(f => uploadFile(f, projectId)) }
      if (newModes) setModes(newModes.split(',') as AgentMode[])
      const reader = res.body.getReader(), dec = new TextDecoder(); let full = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        full += dec.decode(value, { stream: true })
        setMessages(p => p.map(m => m.id === aid ? { ...m, content: full } : m))
      }
      const pid = newPid ?? projectId
      if (pid && full) fetch('/api/messages/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: pid, role: 'assistant', content: full, mode: (newModes ?? 'creative').split(',')[0] }) }).catch(() => {})
      // Clear files that finished uploading after successful send
      setFiles(p => p.filter(f => f.status === 'pending'))
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      // Don't show generic error — the stream now returns human-readable errors inline
      console.error('[SEND]', e)
    } finally { setStreaming(false); inputRef.current?.focus() }
  }, [messages, projectId, streaming, phase, files, uploadFile])

  const onKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(input) }
  }, [input, send])

  const addFiles = useCallback((raw: File[]) => {
    const valid: UploadedFile[] = []
    for (const f of raw) {
      const type = detectAssetType(f.type); if (!type || f.size > MAX_FILE_SIZE_BYTES) continue
      valid.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: f, type, status: 'pending', previewUrl: type === 'image' ? URL.createObjectURL(f) : undefined })
    }
    if (!valid.length) return
    setFiles(p => [...p, ...valid])
    if (projectId) valid.forEach(f => uploadFile(f, projectId))
  }, [projectId, uploadFile])

  const onGate = useCallback((d: GateFormData) => {
    setClientName(d.name)
    if (projectId) fetch('/api/roadmap/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) }).catch(() => {})
    setPhase('hold')
  }, [projectId])

  const locked = phase !== 'discovery' || streaming
  const canSend = input.trim().length > 0 && !locked

  return (
    <div className="flex flex-col bg-[var(--bg)] text-[var(--fg)] font-sans" style={{ height: '100dvh', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <header className="flex-none flex items-center justify-between px-4 sm:px-6 border-b border-[var(--str)] bg-[var(--bg)]/90 backdrop-blur-xl" style={{ height: 56 }}>
        <div className="flex items-center gap-2.5">
          {mounted && <Logo theme={theme} size="md" />}
          <span className="text-2xs font-mono tracking-[.22em] uppercase text-[var(--fg2)] select-none">OmniCraft Studios</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active analysis mode — single pill, informational only, no interaction */}
          <AnimatePresence mode="popLayout">
            {modes.slice(0, 1).map(m => {
              const cfg = MODE_CONFIG[m]
              return (
                <motion.div key={m} layout
                  initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .85 }}
                  transition={{ duration: .22, ease: E }}
                  title={`Active analysis mode: ${cfg.label}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 9, fontFamily: 'monospace', letterSpacing: '.10em', textTransform: 'uppercase', color: cfg.text, userSelect: 'none' }}>
                  <motion.span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, display: 'block' }} animate={{ opacity: [1,.3,1] }} transition={{ duration: 2.4, repeat: Infinity }} />
                  <span className="hidden sm:inline">{cfg.label}</span>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {/* Theme toggle */}
          {mounted && (
            <motion.button onClick={toggle} whileTap={{ scale: .88 }} aria-label="Toggle theme"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-[var(--fg2)] hover:text-[var(--fg)] hover:bg-[var(--mid)] transition-colors">
              <AnimatePresence mode="wait" initial={false}>
                {theme === 'dark'
                  ? <motion.span key="sun" initial={{ opacity: 0, rotate: -30 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 30 }} transition={{ duration: .18 }}><SunIcon /></motion.span>
                  : <motion.span key="moon" initial={{ opacity: 0, rotate: 30 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -30 }} transition={{ duration: .18 }}><MoonIcon /></motion.span>
                }
              </AnimatePresence>
            </motion.button>
          )}
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-chat mx-auto px-4 sm:px-6 py-8 sm:py-12" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <AnimatePresence>{!ready && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ThinkDots /></motion.div>}</AnimatePresence>
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, ease: E, delay: i === 0 ? .48 : 0 }}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant'
                  ? <AIBubble msg={msg} typing={streaming && i === messages.length - 1} />
                  : <UserBubble msg={msg} />}
              </motion.div>
            ))}
          </AnimatePresence>
          {/* Gate */}
          <AnimatePresence>
            {phase === 'gate' && projectId && (
              <motion.div key="gate" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .45, ease: E }} className="flex justify-start">
                <GateForm projectId={projectId} onComplete={onGate} />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Hold */}
          <AnimatePresence>
            {phase === 'hold' && (
              <motion.div key="hold" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .45, ease: E }} className="flex justify-start">
                <HoldScreen clientName={clientName} projectSlug={projectSlug ?? projectId?.slice(0, 8) ?? ''} />
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      </div>

      {/* ── INPUT ── */}
      <div className="flex-none border-t border-[var(--str)] bg-[var(--bg)]/95 backdrop-blur-xl px-3 sm:px-6 pt-3 pb-safe">
        <div className="max-w-chat mx-auto">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35, duration: .5, ease: E }}
            className={cn('rounded-2xl border transition-all duration-200 bg-[var(--in-bg)] border-[var(--in-str)]',
              locked ? 'opacity-40 pointer-events-none select-none' : 'focus-within:border-[var(--strS)] focus-within:shadow-[0_0_0_3px_var(--in-ring)]')}>
            {/* File chips */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                  {files.map(f => (
                    <motion.div key={f.id} initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .85 }}
                      className="flex items-center gap-1.5 bg-[var(--mid)] border border-[var(--str)] rounded-lg px-2.5 py-1 text-xs max-w-[180px]">
                      {f.previewUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={f.previewUrl} alt="" className="w-3.5 h-3.5 rounded object-cover flex-none" />
                        : <span className="flex-none text-sm leading-none">{f.type === 'pdf' ? '📄' : f.type === 'audio' ? '🎙' : '🎬'}</span>}
                      <span className="truncate text-[var(--fg2)]">{f.file.name}</span>
                      <span className="text-[var(--fg3)] flex-none">{formatFileSize(f.file.size)}</span>
                      {f.status === 'uploading' && <motion.span className="flex-none block w-2.5 h-2.5 rounded-full border border-blue-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: .7, repeat: Infinity, ease: 'linear' }} />}
                      {f.status === 'done'  && <span className="flex-none text-emerald-400 text-xs">✓</span>}
                      {f.status === 'error' && <span className="flex-none text-red-400 text-xs">✗</span>}
                      <button onClick={() => { const file = files.find(x => x.id === f.id); if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl); setFiles(p => p.filter(x => x.id !== f.id)) }} className="flex-none text-[var(--fg3)] hover:text-[var(--fg2)] transition-colors ml-0.5">×</button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {/* Row */}
            <div className="flex items-end gap-1 px-2 py-2 sm:py-2.5">
              {/* Attach */}
              <button onClick={() => fileRef.current?.click()} disabled={locked}
                className="flex-none w-9 h-9 rounded-lg flex items-center justify-center text-[var(--fg3)] hover:text-[var(--fg2)] hover:bg-[var(--mid)] transition-colors disabled:opacity-20"
                title="Attach file" aria-label="Attach file">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13.5 6.5L6.5 13.5C5.12 14.88 2.88 14.88 1.5 13.5C.12 12.12.12 9.88 1.5 8.5L8.5 1.5C9.33.67 10.67.67 11.5 1.5C12.33 2.33 12.33 3.67 11.5 4.5L5.21 10.79C4.82 11.18 4.18 11.18 3.79 10.79C3.4 10.4 3.4 9.76 3.79 9.37L9.5 3.67" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <input ref={fileRef} type="file" multiple accept={ALL_ACCEPTED_TYPES} className="hidden"
                onChange={e => { if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = '' } }} />
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} disabled={locked}
                placeholder={phase === 'hold' ? 'Your session is saved.' : phase === 'gate' ? 'Fill in your details above…' : streaming ? 'Thinking…' : 'Describe your project, share a reference…'}
                rows={1} aria-label="Message input"
                className="flex-1 bg-transparent text-[var(--fg)] resize-none leading-relaxed placeholder:text-[var(--fg3)] focus:outline-none disabled:opacity-40 py-1.5 min-h-[28px] max-h-[120px]"
                style={{ fontSize: '16px' }} />
              <motion.button onClick={() => send(input)} disabled={!canSend} whileTap={canSend ? { scale: .88 } : undefined} aria-label="Send"
                className={cn('flex-none w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150', canSend ? 'bg-[var(--fg)] text-[var(--bg)]' : 'bg-[var(--mid)] text-[var(--fg3)] cursor-not-allowed')}>
                {streaming
                  ? <motion.span className="block w-3 h-3 rounded-full border-[1.5px] border-[var(--fg3)] border-t-[var(--fg)]" animate={{ rotate: 360 }} transition={{ duration: .75, repeat: Infinity, ease: 'linear' }} />
                  : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 11V1M6 1L2 5M6 1l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </motion.button>
            </div>
          </motion.div>
          <p className="hidden sm:block text-center text-2xs text-[var(--fg3)] mt-2 select-none">
            {phase === 'discovery' ? 'Return to send · Shift+Return for new line · ⌀ to attach files' : phase === 'gate' ? 'Complete the form above to save your roadmap' : 'Submitted — check back for your roadmap'}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */
function AIBubble({ msg, typing }: { msg: Message; typing: boolean }) {
  return (
    <div className="max-w-[90vw] sm:max-w-[560px] w-full">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--fg)] flex items-center justify-center flex-none"><div className="w-[7px] h-[7px] rounded-[2px] bg-[var(--bg)]" /></div>
        <span className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-[.16em]">OmniCraft Studios</span>
      </div>
      <div className={cn('text-sm text-[var(--fg)] prose-ai', typing && !msg.content ? 'stream-cursor' : '')}>
        {msg.content}
        {typing && msg.content && <motion.span className="inline-block w-0.5 h-[13px] bg-[var(--fg)] ml-px align-middle rounded-full" animate={{ opacity: [1, 0] }} transition={{ duration: .85, repeat: Infinity }} />}
      </div>
    </div>
  )
}
function UserBubble({ msg }: { msg: Message }) {
  return (
    <div className="max-w-[80vw] sm:max-w-[480px]">
      <div className="bg-[var(--surf)] border border-[var(--str)] rounded-2xl rounded-tr-[4px] px-4 py-3">
        <p className="text-sm text-[var(--fg)] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  )
}
function ThinkDots() {
  return (
    <div className="flex items-center gap-1.5 py-2 px-1">
      {[0,1,2].map(i => <motion.span key={i} className="block w-1 h-1 rounded-full bg-[var(--fg3)]" animate={{ opacity: [.2,1,.2] }} transition={{ duration: 1.1, repeat: Infinity, delay: i*.18 }} />)}
    </div>
  )
}
function GateForm({ projectId, onComplete }: { projectId: string; onComplete: (d: GateFormData) => void }) {
  const [form,  setForm]  = useState<GateFormData>({ name: '', company: '', email: '', phone: '' })
  const [errs,  setErrs]  = useState<Partial<GateFormData>>({})
  const [loading, setLoading] = useState(false)
  const fields = [
    { k: 'name'    as const, l: 'Full Name',        t: 'text',  ph: 'Jane Okafor',       req: true  },
    { k: 'company' as const, l: 'Studio / Company', t: 'text',  ph: 'Acme Creative',     req: false },
    { k: 'email'   as const, l: 'Email Address',    t: 'email', ph: 'jane@studio.com',   req: true  },
    { k: 'phone'   as const, l: 'WhatsApp / Phone', t: 'tel',   ph: '+234 801 234 5678', req: true  },
  ]
  const validate = () => {
    const e: Partial<GateFormData> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (!form.phone.trim()) e.phone = 'Required'
    setErrs(e); return !Object.keys(e).length
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!validate() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, ...form }) })
      if (!res.ok) throw new Error()
      onComplete(form)
    } catch { setErrs({ email: 'Something went wrong. Please try again.' }) }
    finally { setLoading(false) }
  }
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45, ease: [.22,1,.36,1] }} className="w-full max-w-[92vw] sm:max-w-md">
      <div className="flex items-center gap-2 mb-3"><div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--fg)] flex items-center justify-center flex-none"><div className="w-[7px] h-[7px] rounded-[2px] bg-[var(--bg)]" /></div><span className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-[.16em]">OmniCraft Studios</span></div>
      <p className="text-sm text-[var(--fg)] leading-[1.85] mb-1">Your roadmap is ready to be saved.</p>
      <p className="text-sm text-[var(--fg2)] leading-[1.85] mb-7">Leave your details and the Studio will return with a finalised scope and quote within 24–48 hours.</p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {fields.map((f, i) => (
          <motion.div key={f.k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i*.06+.1, duration: .3 }}>
            <label className="flex items-center justify-between mb-1.5">
              <span className="text-2xs font-mono text-[var(--fg2)] uppercase tracking-[.12em]">{f.l}</span>
              {!f.req && <span className="text-2xs text-[var(--fg3)]">optional</span>}
            </label>
            <input type={f.t} value={form[f.k] ?? ''} onChange={e => { setForm(p => ({ ...p, [f.k]: e.target.value })); setErrs(p => ({ ...p, [f.k]: undefined })) }} placeholder={f.ph}
              className={cn('w-full rounded-xl px-4 text-sm text-[var(--fg)] bg-[var(--in-bg)] border placeholder:text-[var(--fg3)] focus:outline-none transition-all min-h-[50px]', errs[f.k] ? 'border-red-500/50' : 'border-[var(--in-str)] focus:border-[var(--strS)] focus:shadow-[0_0_0_3px_var(--in-ring)]')} />
            <AnimatePresence>{errs[f.k] && <motion.p initial={{ opacity: 0, y: -3, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0 }} className="text-2xs text-red-400 mt-1 font-mono overflow-hidden">{errs[f.k]}</motion.p>}</AnimatePresence>
          </motion.div>
        ))}
        <motion.button type="submit" disabled={loading} whileTap={{ scale: .97 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .3 }}
          className={cn('w-full rounded-xl text-sm font-medium tracking-wide min-h-[52px] mt-1 transition-all', loading ? 'bg-[var(--mid)] border border-[var(--str)] text-[var(--fg2)] cursor-wait' : 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 active:scale-[.98]')}>
          {loading ? <span className="flex items-center justify-center gap-2"><motion.span className="block w-3.5 h-3.5 rounded-full border-[1.5px] border-[var(--fg2)] border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: .75, repeat: Infinity, ease: 'linear' }} />Saving…</span> : 'Save My Roadmap →'}
        </motion.button>
        <p className="text-2xs text-[var(--fg3)] text-center pb-1">Your details are used solely to deliver your project roadmap.</p>
      </form>
    </motion.div>
  )
}
function HoldScreen({ clientName, projectSlug }: { clientName?: string; projectSlug: string }) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/p/${projectSlug}`
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease: [.22,1,.36,1] }} className="w-full max-w-[92vw] sm:max-w-md">
      <div className="flex items-center gap-2 mb-3"><div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--fg)] flex items-center justify-center flex-none"><div className="w-[7px] h-[7px] rounded-[2px] bg-[var(--bg)]" /></div><span className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-[.16em]">OmniCraft Studios</span></div>
      <div className="flex items-center gap-2.5 mb-6">
        <span className="relative flex h-2 w-2 flex-none"><motion.span className="absolute inset-0 rounded-full bg-amber-400" animate={{ scale: [1,2.8,1], opacity: [.8,0,.8] }} transition={{ duration: 2.2, repeat: Infinity }} /><span className="relative block h-full w-full rounded-full bg-amber-400" /></span>
        <span className="text-2xs font-mono text-amber-400 uppercase tracking-widest">Reviewing complexity</span>
      </div>
      <div className="space-y-3 text-sm leading-[1.85] mb-7">
        <p className="text-[var(--fg)]">{clientName ? `Thank you, ${clientName.split(' ')[0]}.` : "You're in."}{' '}Everything we've built here is saved to your private dashboard.</p>
        <p className="text-[var(--fg2)]">The Studio Owner is reviewing the AI-generated roadmap to validate scope and finalise pricing. Expect to hear back within 24–48 hours.</p>
      </div>
      <div className="bg-[var(--surf)] border border-[var(--str)] rounded-2xl p-4 sm:p-5">
        <p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest mb-2">Your Dashboard</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-[var(--fg2)] break-all hover:text-[var(--fg)] transition-colors">{url}</a>
        <p className="text-2xs text-[var(--fg3)] mt-3">Bookmark this link. Your roadmap and quote appear here once published.</p>
      </div>
    </motion.div>
  )
}
function SunIcon() { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 1v1.6M7.5 12.4V14M1 7.5h1.6M12.4 7.5H14M3.05 3.05l1.13 1.13M10.82 10.82l1.13 1.13M3.05 11.95l1.13-1.13M10.82 4.18l1.13-1.13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function MoonIcon() { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13 9.5A6 6 0 016 2.5a6 6 0 100 10A6 6 0 0013 9.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg> }
