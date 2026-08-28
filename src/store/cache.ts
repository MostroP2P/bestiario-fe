/**
 * The document cache.
 *
 * A latency optimisation and never a source of truth: cleared storage costs a
 * round trip and changes no figure. A cached entry is served only when its
 * hash matches the *current* index — nothing else may promote one to the
 * screen, because a closed partition with an unchanged hash is immutable and
 * a changed one is a different document.
 *
 * Every access is wrapped: a browser in private mode, one with site data
 * disabled, and one at its quota all throw rather than return nothing, and
 * the site is fully functional with no cache at all.
 */
import { CACHE_SCHEMA_VERSION } from '~/config'
import type { Envelope } from '~/nostr/documents'

const PREFIX = 'bestiario:doc:'
const VERSION_KEY = 'bestiario:schema'

export type CachedDocument = {
  readonly hash: string
  readonly envelope: Envelope
  readonly createdAt: number
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

/** Drops everything when the schema moved: migrating a cache is not worth it. */
export function openCache(): void {
  const store = storage()
  if (!store) return
  try {
    if (store.getItem(VERSION_KEY) === String(CACHE_SCHEMA_VERSION)) return
    for (const key of Object.keys(store)) {
      if (key.startsWith(PREFIX)) store.removeItem(key)
    }
    store.setItem(VERSION_KEY, String(CACHE_SCHEMA_VERSION))
  } catch {
    // A cache that cannot be cleared is a cache that will not be read.
  }
}

/** The cached document for `d`, but only if its hash is the one asked for. */
export function readCached(d: string, hash: string): CachedDocument | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(PREFIX + d)
    if (!raw) return null
    const entry = JSON.parse(raw) as CachedDocument
    return entry.hash === hash ? entry : null
  } catch {
    return null
  }
}

export function writeCached(d: string, entry: CachedDocument): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(PREFIX + d, JSON.stringify(entry))
  } catch {
    // Over quota, or refused. The document is on screen either way.
  }
}

export function clearCache(): void {
  const store = storage()
  if (!store) return
  try {
    for (const key of Object.keys(store)) {
      if (key.startsWith(PREFIX)) store.removeItem(key)
    }
  } catch {
    // Nothing to do: the cache is advisory.
  }
}
