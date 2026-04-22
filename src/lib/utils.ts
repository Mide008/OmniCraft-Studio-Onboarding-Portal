import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AgentMode, AssetType } from '@/types'

// ============================================================
// TAILWIND CLASS MERGING
// ============================================================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================
// SLUG GENERATION
// Generates a short, URL-safe, unique project identifier
// ============================================================
export function generateSlug(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => chars[byte % chars.length]).join('')
}

// ============================================================
// FILE UTILITIES
// ============================================================
export const ACCEPTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  pdf:   ['application/pdf'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/webm', 'audio/ogg', 'audio/mp4'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
} satisfies Record<AssetType, string[]>

export const ALL_ACCEPTED_TYPES = Object.values(ACCEPTED_MIME_TYPES).flat().join(',')

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

export function detectAssetType(mimeType: string): AssetType | null {
  for (const [type, mimes] of Object.entries(ACCEPTED_MIME_TYPES)) {
    if (mimes.includes(mimeType)) return type as AssetType
  }
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

// ============================================================
// MODE UTILITIES
// ============================================================
export const MODE_LABELS: Record<AgentMode, string> = {
  creative:    'Creative',
  engineering: 'Engineering',
  research:    'Research',
}

export const MODE_COLORS: Record<AgentMode, { text: string; dot: string; bg: string; border: string }> = {
  creative: {
    text:   'text-purple-400',
    dot:    'bg-purple-400',
    bg:     'bg-creative-dim',
    border: 'border-purple-900',
  },
  engineering: {
    text:   'text-blue-400',
    dot:    'bg-blue-400',
    bg:     'bg-engineering-dim',
    border: 'border-blue-900',
  },
  research: {
    text:   'text-emerald-400',
    dot:    'bg-emerald-400',
    bg:     'bg-research-dim',
    border: 'border-emerald-900',
  },
}

// ============================================================
// DATE / TIME
// ============================================================
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)

  if (diffMins < 1)  return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================================
// STRING UTILITIES
// ============================================================
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
