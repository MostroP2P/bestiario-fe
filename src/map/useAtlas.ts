/**
 * Loading the country geometry.
 *
 * The atlas is a 108 KB asset served from this site's own origin, not a CDN
 * (SPEC 1.1), and it is not part of the JavaScript bundle — which is what
 * keeps the budget of SPEC 11 honest. It is fetched once and shared.
 *
 * A map that cannot load its geometry says so. It does not fall back to a
 * decorative shape and it does not silently render an empty panel.
 */
import { useEffect, useState } from 'preact/hooks'
import type { Topology } from 'topojson-specification'
import { buildAtlas, type Atlas } from '~/model/atlas'

export type AtlasState =
  | { status: 'loading' }
  | { status: 'ready'; atlas: Atlas }
  | { status: 'failed'; reason: string }

const cache = new Map<string, Promise<Atlas>>()

/**
 * Forgets what has been loaded. The app has no reason to call this; tests do,
 * because a cache that outlives a test case makes the failure path
 * unreachable.
 */
export function clearAtlasCache(): void {
  cache.clear()
}

function loadAtlas(url: string): Promise<Atlas> {
  const existing = cache.get(url)
  if (existing) return existing

  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return response.json() as Promise<Topology>
    })
    .then(buildAtlas)
    .catch((error: unknown) => {
      // A failure is not cached: a reader who reconnects deserves a retry.
      cache.delete(url)
      throw error
    })

  cache.set(url, pending)
  return pending
}

export function useAtlas(url: string): AtlasState {
  const [state, setState] = useState<AtlasState>({ status: 'loading' })

  useEffect(() => {
    let live = true
    loadAtlas(url).then(
      (atlas) => live && setState({ status: 'ready', atlas }),
      (error: unknown) =>
        live &&
        setState({
          status: 'failed',
          reason: error instanceof Error ? error.message : 'unknown error',
        }),
    )
    return () => {
      live = false
    }
  }, [url])

  return state
}
