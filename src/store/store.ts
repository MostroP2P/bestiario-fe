/**
 * What the views read.
 *
 * The client algorithm of SPEC 6, as state: fetch the index, verify it, then
 * fetch only the documents the current view needs and check each against the
 * hash the index named for it. Views read this and never a relay; the relay
 * layer never touches the DOM.
 *
 * Failing to obtain a verified index is the one fatal state. Everything else
 * degrades and says how: `unavailable` is a relay's silence, `unverified` is
 * a failed proof, and the two are visibly different because one is a network
 * and the other is a lie.
 */
import { signal, type Signal } from '@preact/signals'
import type { Event } from 'nostr-tools'
import { BESTIARIO_KIND, TIMEOUTS } from '~/config'
import type { Relays, RelayState } from '~/nostr/pool'
import { verifyDocument, verifyIndex, type Failure } from '~/nostr/verify'
import type { Envelope, IndexDoc, IndexEntry } from '~/nostr/documents'
import { openCache, readCached, writeCached } from './cache'

export type DocState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'cached' | 'live'
      readonly envelope: Envelope
      /** The event's signed `created_at`, in seconds. Never `generated_at`. */
      readonly createdAt: number
      readonly entry: IndexEntry
    }
  | { readonly status: 'unavailable' }
  | { readonly status: 'unverified'; readonly reason: Failure }

export type BootState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly index: IndexDoc; readonly createdAt: number }
  | { readonly status: 'failed'; readonly reason: Failure | 'timeout' }

export type Store = {
  readonly boot: Signal<BootState>
  readonly documents: Signal<ReadonlyMap<string, DocState>>
  readonly relays: Signal<readonly RelayState[]>
  /** Fetch the index and open the standing subscription to it. */
  start(): Promise<void>
  /** Ensure these `d` values are loaded, from cache where the hash matches. */
  need(ds: readonly string[]): Promise<void>
  stop(): void
}

/** The newest event per `d`: a relay serving a stale replaceable event is normal. */
function newestPerD(events: readonly Event[]): Map<string, Event> {
  const newest = new Map<string, Event>()
  for (const event of events) {
    const d = event.tags.find((tag) => tag[0] === 'd')?.[1]
    if (!d) continue
    const held = newest.get(d)
    if (!held || event.created_at > held.created_at) newest.set(d, event)
  }
  return newest
}

export function createStore(relays: Relays, publisher: string): Store {
  const boot = signal<BootState>({ status: 'loading' })
  const documents = signal<ReadonlyMap<string, DocState>>(new Map())
  const relayStates = signal<readonly RelayState[]>(relays.states())

  let unsubscribe: (() => void) | null = null

  const setDoc = (d: string, state: DocState) => {
    const next = new Map(documents.value)
    next.set(d, state)
    documents.value = next
  }

  const refreshRelays = () => {
    relayStates.value = relays.states()
  }

  async function readIndex(): Promise<void> {
    const events = await relays.query(
      { kinds: [BESTIARIO_KIND], authors: [publisher], '#d': ['index'], limit: 1 },
      TIMEOUTS.index,
    )
    refreshRelays()

    const newest = newestPerD(events).get('index')
    if (!newest) {
      boot.value = { status: 'failed', reason: 'timeout' }
      return
    }

    const verified = verifyIndex(newest, publisher)
    if (!verified.ok) {
      boot.value = { status: 'failed', reason: verified.reason }
      return
    }

    const previous = boot.value.status === 'ready' ? boot.value.index : null
    boot.value = { status: 'ready', index: verified.value, createdAt: newest.created_at }

    // The index is the trigger (§6.3). Entries whose hash moved are stale in
    // whatever the views are already holding; drop them so `need` refetches.
    if (previous) {
      const before = new Map(previous.documents.map((entry) => [entry.d, entry.hash]))
      const changed = verified.value.documents.filter(
        (entry) => before.get(entry.d) !== undefined && before.get(entry.d) !== entry.hash,
      )
      if (changed.length > 0) {
        void fetchDocuments(changed.map((entry) => entry.d))
      }
    }
  }

  function entriesFor(ds: readonly string[]): IndexEntry[] {
    if (boot.value.status !== 'ready') return []
    const named = new Map(boot.value.index.documents.map((entry) => [entry.d, entry]))
    return ds.flatMap((d) => {
      const entry = named.get(d)
      return entry ? [entry] : []
    })
  }

  async function fetchDocuments(ds: readonly string[]): Promise<void> {
    const entries = entriesFor(ds)
    // A `d` the index does not name was never published; that is a different
    // answer from a relay withholding it, and the views say so.
    for (const d of ds) {
      if (!entries.some((entry) => entry.d === d)) setDoc(d, { status: 'unavailable' })
    }
    if (entries.length === 0) return

    const wanted: IndexEntry[] = []
    for (const entry of entries) {
      const cached = readCached(entry.d, entry.hash)
      if (cached) {
        setDoc(entry.d, {
          status: 'cached',
          envelope: cached.envelope,
          createdAt: cached.createdAt,
          entry,
        })
      } else {
        setDoc(entry.d, { status: 'loading' })
        wanted.push(entry)
      }
    }
    if (wanted.length === 0) return

    // One round trip per route, not one per panel: tag filters OR their
    // values, which is what §4.1 intends.
    const events = await relays.query({
      kinds: [BESTIARIO_KIND],
      authors: [publisher],
      '#d': wanted.map((entry) => entry.d),
    })
    refreshRelays()
    const newest = newestPerD(events)

    await Promise.all(
      wanted.map(async (entry) => {
        const event = newest.get(entry.d)
        if (!event) {
          setDoc(entry.d, { status: 'unavailable' })
          return
        }
        const verified = await verifyDocument(event, publisher, entry.hash)
        if (!verified.ok) {
          setDoc(entry.d, { status: 'unverified', reason: verified.reason })
          return
        }
        setDoc(entry.d, {
          status: 'live',
          envelope: verified.value,
          createdAt: event.created_at,
          entry,
        })
        writeCached(entry.d, {
          hash: entry.hash,
          envelope: verified.value,
          createdAt: event.created_at,
        })
      }),
    )
  }

  return {
    boot,
    documents,
    relays: relayStates,

    async start() {
      openCache()
      await readIndex()
      // A replacement index arrives here; documents follow from its diff.
      unsubscribe = relays.subscribe(
        { kinds: [BESTIARIO_KIND], authors: [publisher], '#d': ['index'] },
        () => {
          void readIndex()
        },
      )
    },

    need: fetchDocuments,

    stop() {
      unsubscribe?.()
      unsubscribe = null
      relays.close()
    },
  }
}
