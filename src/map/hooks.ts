/**
 * The two things the map needs from the browser rather than from the data:
 * how wide it is, and whether the reader wants movement at all.
 */
import { useEffect, useState } from 'preact/hooks'
import type { RefObject } from 'preact'

export function useMeasuredWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return width
}

/** SPEC 13: reduced motion is honoured, and honoured when it changes. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
