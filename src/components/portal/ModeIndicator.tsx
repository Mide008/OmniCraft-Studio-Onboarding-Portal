'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { AgentMode } from '@/types'
import { cn } from '@/lib/utils'

const MODE: Record<AgentMode, { label: string; dot: string; pill: string }> = {
  creative:    { label: 'Creative',    dot: 'bg-purple-500',  pill: 'border-purple-800/50  text-purple-300  bg-purple-500/[0.08]' },
  engineering: { label: 'Engineering', dot: 'bg-blue-500',    pill: 'border-blue-800/50    text-blue-300    bg-blue-500/[0.08]'   },
  research:    { label: 'Research',    dot: 'bg-emerald-500', pill: 'border-emerald-800/50 text-emerald-300 bg-emerald-500/[0.08]'},
}

export default function ModeIndicator({ modes }: { modes: AgentMode[] }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <AnimatePresence mode="popLayout">
        {modes.map(mode => {
          const { label, dot, pill } = MODE[mode]
          return (
            <motion.div
              key={mode} layout
              initial={{ opacity: 0, scale: 0.75, x: 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.75, x: 8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'flex items-center gap-1.5 px-2 py-0.5 rounded-full border',
                'text-2xs font-mono tracking-widest uppercase whitespace-nowrap',
                pill
              )}
            >
              <motion.span
                className={cn('block w-1.5 h-1.5 rounded-full flex-none', dot)}
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="hidden sm:inline">{label}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
