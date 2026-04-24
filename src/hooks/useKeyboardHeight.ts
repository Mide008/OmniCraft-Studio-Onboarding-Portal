'use client'
import { useEffect, useState } from 'react'

/**
 * Tracks the height of the software keyboard on mobile (iOS + Android).
 * Uses the visualViewport API — the most reliable method in 2025.
 * Returns keyboardHeight in pixels (0 when keyboard is closed).
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let lastWindowHeight = window.innerHeight

    const update = () => {
      const currentViewportHeight = vv.height + vv.offsetTop
      const diff = lastWindowHeight - currentViewportHeight
      // Only treat as keyboard if diff > 100px (avoids false positives from browser chrome)
      setKeyboardHeight(diff > 100 ? diff : 0)
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    // Also listen for window resize (catches some edge cases on Android)
    const onWindowResize = () => {
      lastWindowHeight = window.innerHeight
      update()
    }
    window.addEventListener('resize', onWindowResize)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', onWindowResize)
    }
  }, [])

  return keyboardHeight
}
