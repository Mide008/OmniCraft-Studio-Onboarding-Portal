'use client'
import Image from 'next/image'
import { motion } from 'framer-motion'

// Set USE_CUSTOM=true after placing logos at:
// /public/logos/logo-dark.svg   (used on light backgrounds)
// /public/logos/logo-light.svg  (used on dark backgrounds)
const USE_CUSTOM = true

export interface LogoProps {
  theme: 'dark' | 'light'
  size?: 'sm' | 'md'
  className?: string
}

export default function Logo({ theme, size = 'md', className = '' }: LogoProps) {
  const height = size === 'sm' ? 18 : 22

  if (USE_CUSTOM) {
    const src = theme === 'dark' ? '/logos/logo-light.svg' : '/logos/logo-dark.svg'
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src={src}
          alt="OmniCraft Studios"
          width={0}
          height={height}
          priority
          draggable={false}
          className={className}
          style={{ height, width: 'auto', display: 'block' }}
        />
      </motion.div>
    )
  }

  // Geometric fallback (no custom SVG)
  const outer = size === 'sm' ? 20 : 24
  const inner = size === 'sm' ? 8 : 10
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      role="img"
      aria-label="OmniCraft Studios"
      className={`flex-none flex items-center justify-center rounded-md bg-[var(--fg)] ${className}`}
      style={{ width: outer, height: outer }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.2 }}
        className="rounded-sm bg-[var(--bg)]"
        style={{ width: inner, height: inner }}
      />
    </motion.div>
  )
}