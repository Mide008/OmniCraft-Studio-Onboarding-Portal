'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { UploadedFile, AssetType } from '@/types'
import { detectAssetType, formatFileSize, MAX_FILE_SIZE_BYTES, ALL_ACCEPTED_TYPES, cn } from '@/lib/utils'

const ASSET_ICON: Record<AssetType, string> = { image: '🖼', pdf: '📄', audio: '🎙', video: '🎬' }

type BaseProps = { onFilesAdd: (f: UploadedFile[]) => void; disabled?: boolean }

function useProcessor(onFilesAdd: (f: UploadedFile[]) => void) {
  return useCallback((raw: File[]) => {
    const valid: UploadedFile[] = []
    for (const file of raw) {
      const type = detectAssetType(file.type)
      if (!type || file.size > MAX_FILE_SIZE_BYTES) continue
      valid.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, type, status: 'pending', previewUrl: type === 'image' ? URL.createObjectURL(file) : undefined })
    }
    if (valid.length) onFilesAdd(valid)
  }, [onFilesAdd])
}

/* File chip display — renders nothing when files is empty */
export function FileChips({ files, onRemove }: { files: UploadedFile[]; onRemove: (id: string) => void }) {
  return (
    <AnimatePresence>
      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap gap-1.5 px-3 pt-2.5"
        >
          {files.map(f => (
            <motion.div key={f.id}
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.82 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-1.5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs max-w-[160px] group"
            >
              {f.previewUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={f.previewUrl} alt="" className="w-4 h-4 rounded object-cover flex-none" />
                : <span className="flex-none text-sm leading-none">{ASSET_ICON[f.type]}</span>
              }
              <span className="text-[var(--fg-muted)] truncate">{f.file.name}</span>
              <span className="text-[var(--fg-subtle)] flex-none">{formatFileSize(f.file.size)}</span>
              {f.status === 'uploading' && (
                <motion.span className="block w-2.5 h-2.5 rounded-full border border-blue-400 border-t-transparent flex-none"
                  animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
              )}
              {f.status === 'done'  && <span className="text-emerald-400 flex-none text-xs">✓</span>}
              {f.status === 'error' && <span className="text-red-400 flex-none text-xs">✗</span>}
              <button onClick={() => onRemove(f.id)} aria-label="Remove file"
                className="text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] transition-colors flex-none ml-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
              >×</button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* Attach button — paperclip icon + drag-and-drop */
export function AttachButton({ onFilesAdd, disabled }: BaseProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const process = useProcessor(onFilesAdd)

  return (
    <>
      {/* Global drag overlay */}
      <AnimatePresence>
        {drag && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/90 backdrop-blur-lg"
            onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) process(Array.from(e.dataTransfer.files)) }}
            onDragOver={e => e.preventDefault()}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false) }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="border-2 border-dashed border-[var(--border-strong)] rounded-3xl px-14 py-10 text-center pointer-events-none"
            >
              <p className="text-[var(--fg)] font-mono text-xs tracking-[0.2em] uppercase mb-1.5">Drop files here</p>
              <p className="text-[var(--fg-subtle)] text-xs">Images · PDFs · Audio · Video</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={inputRef} type="file" multiple accept={ALL_ACCEPTED_TYPES} className="hidden" disabled={disabled}
        onChange={e => { if (e.target.files) { process(Array.from(e.target.files)); e.target.value = '' } }}
      />

      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) process(Array.from(e.dataTransfer.files)) }}
        disabled={disabled}
        aria-label="Attach file"
        title="Attach file (or drag & drop anywhere)"
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded-lg flex-none',
          'text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] hover:bg-[var(--surface-hover)]',
          'transition-colors duration-150',
          'disabled:opacity-25 disabled:cursor-not-allowed'
        )}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
          <path d="M13.5 6.5L6.5 13.5C5.12 14.88 2.88 14.88 1.5 13.5 .12 12.12.12 9.88 1.5 8.5l7-7C9.33.67 10.67.67 11.5 1.5c.83.83.83 2.17 0 3L5.21 10.79c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41L9.5 3.67"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>
    </>
  )
}

/* Default export — composed (for places that want both) */
export default function FileUpload({
  files, onFilesAdd, onFileRemove, disabled,
}: { files: UploadedFile[]; onFilesAdd: (f: UploadedFile[]) => void; onFileRemove: (id: string) => void; disabled?: boolean }) {
  return <>
    <FileChips files={files} onRemove={onFileRemove} />
    <AttachButton onFilesAdd={onFilesAdd} disabled={disabled} />
  </>
}
