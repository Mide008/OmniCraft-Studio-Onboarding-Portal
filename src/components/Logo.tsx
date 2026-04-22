'use client'
import Image from 'next/image'

/**
 * Logo component
 * Assumes files are at:   /public/logos/logo-dark.svg   (dark logo → use on LIGHT backgrounds)
 *                          /public/logos/logo-light.svg  (light logo → use on DARK backgrounds)
 *
 * To disable and use geometric fallback: set USE_CUSTOM = false
 */
const USE_CUSTOM = true

export interface LogoProps {
  theme?:     'dark' | 'light'   // now optional
  size?:      'sm' | 'md'
  className?: string
}

export default function Logo({ theme = 'dark', size = 'md', className = '' }: LogoProps) {
  // On a DARK background → use the LIGHT (white) logo
  // On a LIGHT background → use the DARK (black) logo
  const src = theme === 'dark' ? '/logos/logo-light.svg' : '/logos/logo-dark.svg'

  // Compact sizing — height drives it, width is auto
  const h = size === 'sm' ? 18 : 22

  if (USE_CUSTOM) {
    return (
      <Image
        src={src}
        alt="OmniCraft Studios"
        width={0}
        height={h}
        priority
        draggable={false}
        className={className}
        style={{ height: h, width: 'auto', display: 'block' }}
      />
    )
  }

  // Geometric fallback
  const outer = size === 'sm' ? 20 : 24
  const inner = size === 'sm' ? 8 : 10
  return (
    <div
      role="img"
      aria-label="OmniCraft Studios"
      className={`flex-none flex items-center justify-center rounded-md bg-[var(--fg)] ${className}`}
      style={{ width: outer, height: outer }}
    >
      <div className="rounded-sm bg-[var(--bg)]" style={{ width: inner, height: inner }} />
    </div>
  )
}