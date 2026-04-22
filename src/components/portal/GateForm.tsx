'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { GateFormData } from '@/types'

const FIELDS = [
  { key: 'name'    as const, label: 'Full Name',        type: 'text',  placeholder: 'Jane Okafor',       required: true,  auto: 'name' },
  { key: 'company' as const, label: 'Studio / Company', type: 'text',  placeholder: 'Acme Creative',     required: false, auto: 'organization' },
  { key: 'email'   as const, label: 'Email Address',    type: 'email', placeholder: 'jane@studio.com',   required: true,  auto: 'email' },
  { key: 'phone'   as const, label: 'WhatsApp / Phone', type: 'tel',   placeholder: '+234 801 234 5678', required: true,  auto: 'tel' },
]

export default function GateForm({
  projectId,
  onComplete,
}: {
  projectId: string
  onComplete: (d: GateFormData) => void
}) {
  const [form,    setForm]    = useState<GateFormData>({ name: '', company: '', email: '', phone: '' })
  const [errors,  setErrors]  = useState<Partial<GateFormData>>({})
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const e: Partial<GateFormData> = {}
    if (!form.name.trim())  e.name  = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.phone.trim()) e.phone = 'Required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, ...form }),
      })
      if (!res.ok) throw new Error()
      onComplete(form)
    } catch {
      setErrors({ email: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const update = (key: keyof GateFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [key]: e.target.value }))
    setErrors(p => ({ ...p, [key]: undefined }))
  }

  return (
    <div className="w-full max-w-[92vw] sm:max-w-md">
      {/* Sender label */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 rounded-md bg-[var(--fg)] flex items-center justify-center flex-none">
          <div className="w-2 h-2 rounded-[3px] bg-[var(--bg)]" />
        </div>
        <span className="text-2xs font-mono text-[var(--fg-subtle)] uppercase tracking-[0.15em]">OmniCraft Studios</span>
      </div>

      <p className="text-sm sm:text-base text-[var(--fg)] leading-[1.85] mb-1">
        Your roadmap is ready to be saved.
      </p>
      <p className="text-sm text-[var(--fg-muted)] leading-[1.85] mb-6">
        Leave your details and the Studio will return with a finalised scope and quote — typically within 24–48 hours.
      </p>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {FIELDS.map((f, i) => (
          <motion.div
            key={f.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.055 + 0.05, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor={`gate-${f.key}`} className="text-2xs font-mono text-[var(--fg-muted)] uppercase tracking-[0.12em]">
                {f.label}
              </label>
              {!f.required && <span className="text-2xs text-[var(--fg-subtle)]">optional</span>}
            </div>

            <input
              id={`gate-${f.key}`}
              type={f.type}
              inputMode={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'}
              value={form[f.key] ?? ''}
              onChange={update(f.key)}
              placeholder={f.placeholder}
              autoComplete={f.auto}
              className={cn(
                'w-full bg-[var(--input-bg)] rounded-xl px-4 h-12 border',
                'text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
                'focus:outline-none transition-all duration-150',
                errors[f.key]
                  ? 'border-red-500/50 bg-red-500/[0.04]'
                  : 'border-[var(--input-border)] focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.07)]'
              )}
            />

            <AnimatePresence>
              {errors[f.key] && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-2xs text-red-400 mt-1.5 font-mono overflow-hidden"
                >
                  {errors[f.key]}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        <motion.button
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'w-full h-12 rounded-xl text-sm font-medium tracking-wide mt-1',
            'transition-all duration-200',
            loading
              ? 'bg-[var(--surface)] border border-[var(--border)] text-[var(--fg-muted)] cursor-wait'
              : 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 active:scale-[0.98]'
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2.5">
              <motion.span
                className="block w-3.5 h-3.5 rounded-full border-[1.5px] border-[var(--fg-subtle)] border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              />
              Saving your roadmap...
            </span>
          ) : 'Save My Roadmap →'}
        </motion.button>

        <p className="text-2xs text-[var(--fg-subtle)] text-center pt-1">
          Used only to deliver your project roadmap. Never shared.
        </p>
      </form>
    </div>
  )
}
