import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function generateSlug(): string { const c='abcdefghijklmnopqrstuvwxyz0123456789'; return Array.from({length:8},()=>c[Math.floor(Math.random()*c.length)]).join('') }
export function formatFileSize(bytes: number): string { if(bytes<1024)return bytes+'B'; if(bytes<1024*1024)return (bytes/1024).toFixed(0)+'KB'; return (bytes/1024/1024).toFixed(1)+'MB' }
export const MAX_FILE_SIZE_BYTES = 3*1024*1024
export function detectAssetType(mimeType: string): 'image'|'pdf'|'audio'|'video'|null { if(mimeType.startsWith('image/'))return 'image'; if(mimeType==='application/pdf')return 'pdf'; if(mimeType.startsWith('audio/'))return 'audio'; if(mimeType.startsWith('video/'))return 'video'; return null }
export const ALL_ACCEPTED_TYPES = 'image/*,application/pdf,audio/*,video/*'
