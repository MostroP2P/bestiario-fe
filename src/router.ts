/**
 * Where the reader is, as a link they can send someone.
 *
 * Hash routing, because GitHub Pages serves no rewrite rules and a path
 * route deep-linked is a 404 (SPEC 10.2). The window rides in the query, so
 * a link carries what was on screen and not merely which page it was.
 *
 * Nothing here throws. A hash is something anyone can type, so an
 * unreadable one opens the overview rather than an error.
 */
import { useCallback, useEffect, useState } from 'preact/hooks'
import { WINDOWS, type Span } from '~/nostr/address'

export const ROUTES = ['overview', 'orders', 'volume'] as const
export type Route = (typeof ROUTES)[number]

/** The window the site opens in when a link does not say. */
export const DEFAULT_WINDOW: Span = '30d'

/** The path each route is addressed by. The overview is the site's root. */
const PATHS: Readonly<Record<Route, string>> = {
  overview: '/',
  orders: '/orders',
  volume: '/volume',
}

export type Location = {
  readonly route: Route
  readonly window: Span
}

function isSpan(text: string): text is Span {
  return (WINDOWS as readonly string[]).includes(text)
}

function routeOf(path: string): Route {
  const wanted = `/${path.replace(/^\/+|\/+$/g, '').toLowerCase()}`
  return ROUTES.find((route) => PATHS[route] === wanted) ?? 'overview'
}

/** What a hash means, however it was written. */
export function parseHash(hash: string): Location {
  const text = hash.replace(/^#/, '')
  const [path = '', query = ''] = text.split('?', 2)
  const asked = new URLSearchParams(query).get('w') ?? ''
  return {
    route: routeOf(path),
    window: isSpan(asked) ? asked : DEFAULT_WINDOW,
  }
}

/** The shortest hash that means this location. */
export function printHash(location: Location): string {
  const path = PATHS[location.route]
  const query = location.window === DEFAULT_WINDOW ? '' : `?w=${location.window}`
  return `#${path}${query}`
}

/**
 * The current location, and the way to change it.
 *
 * The hash is the state: `go` writes it and the browser's own event brings
 * it back, so the back button, a typed URL and a shared link all arrive
 * through the same door.
 */
export function useLocation(): {
  readonly location: Location
  readonly go: (next: Location) => void
} {
  const [location, setLocation] = useState<Location>(() =>
    parseHash(globalThis.location?.hash ?? ''),
  )

  useEffect(() => {
    const read = () => setLocation(parseHash(globalThis.location.hash))
    read()
    globalThis.addEventListener('hashchange', read)
    return () => globalThis.removeEventListener('hashchange', read)
  }, [])

  // The hash is written *and* the state is set: a browser is not obliged to
  // deliver `hashchange` before the next paint, and a tab that does not
  // change under the reader's finger is worth not depending on that.
  const go = useCallback((next: Location) => {
    globalThis.location.hash = printHash(next)
    setLocation(next)
  }, [])

  return { location, go }
}
