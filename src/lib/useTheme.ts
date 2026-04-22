'use client'
import { useCallback, useEffect, useState } from 'react'
export type Theme = 'dark' | 'light'
const KEY = 'oc-theme'
export function useTheme() {
  const [theme, setT] = useState<Theme>('dark')
  const [mounted, setM] = useState(false)
  useEffect(() => {
    const s = localStorage.getItem(KEY) as Theme | null
    setT(s === 'dark' || s === 'light' ? s : window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light')
    setM(true)
  }, [])
  const setTheme = useCallback((n: Theme) => {
    setT(n); localStorage.setItem(KEY, n)
    document.documentElement.setAttribute('data-theme', n)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', n === 'dark' ? '#080808' : '#F4F2EC')
  }, [])
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])
  return { theme, toggle, mounted }
}
