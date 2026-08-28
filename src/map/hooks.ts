/**
 * The two things the map needs from the browser rather than from the data:
 * how wide it is, and whether the reader wants movement at all.
 */
import { useEffect, useState } from 'preact/hooks'
import type { RefObject } from 'preact'

export type Size = { readonly width: number; readonly height: number }

/**
 * The element's own box. The map is sized by CSS so it grows with the
 * viewport, and the projection is fitted to whatever that turns out to be
 * rather than to a number this file guessed.
 */
export function useMeasuredSize(ref: RefObject<HTMLElement>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return size
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
