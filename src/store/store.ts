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
import {
  BESTIARIO_KIND,
  DISPUTES,
  MAP,
  MOSTRO_DISPUTE_KIND,
  MOSTRO_ORDER_KIND,
  TIMEOUTS,
} from '~/config'
import type { Relays, RelayState } from '~/nostr/pool'
import { verifyDocument, verifyFrom, verifyIndex, type Failure } from '~/nostr/verify'
import type { Envelope, IndexDoc, IndexEntry } from '~/nostr/documents'
import { disputeFrom, orderFrom } from '~/nostr/mostro'
import { keyOf, supersedes, type LiveDispute, type Revision } from '~/model/open-disputes'
import type { LiveOrder } from '~/model/live-lines'
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
  /**
   * The instances' own dispute events, newest revision per dispute. Raw:
   * which of them are open, and how recent is recent enough, is decided in
   * `model/open-disputes.ts` against the reader's clock.
   */
  readonly disputes: Signal<readonly LiveDispute[]>
  /**
   * Whether the relays have answered for the instances currently watched. An
   * empty book before they have is a verdict nobody has given yet.
   */
  readonly disputesReady: Signal<boolean>
  /**
   * The instances' own order events, newest revision per order. Raw, like
   * the disputes: which of them draw a line is `model/live-lines.ts`'s call.
   */
  readonly orders: Signal<readonly LiveOrder[]>
  /** Whether the relays have answered for the orders of the watched instances. */
  readonly ordersReady: Signal<boolean>
  /** Fetch the index and open the standing subscription to it. */
  start(): Promise<void>
  /** Ensure these `d` values are loaded, from cache where the hash matches. */
  need(ds: readonly string[]): Promise<void>
  /**
   * Follow these instances' own events — their disputes and their orders.
   * Re-watching the same set is free.
   */
  watchInstances(authors: readonly string[]): Promise<void>
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
  const disputes = signal<readonly LiveDispute[]>([])
  const disputesReady = signal(false)
  const orders = signal<readonly LiveOrder[]>([])
  const ordersReady = signal(false)

  let unsubscribe: (() => void) | null = null
  /** The standing subscriptions to the instances' own events. */
  let liveUnsubscribe: (() => void)[] = []
  /**
   * The instance set currently followed, as a stable key. Null until the
   * first watch: the empty set is a set, and answering it is what tells the
   * panel that an empty book is an answer and not a wait.
   */
  let watched: string | null = null
  /**
   * Advances on every watch. A query answers for the watch that sent it, and
   * a watch that comes back to the same set is still a newer watch: its key
   * matches, its generation does not.
   */
  let generation = 0

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
        (entry) =>
          before.get(entry.d) !== undefined && before.get(entry.d) !== entry.hash,
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

  /**
   * Follow one kind of the instances' own addressable events into a signal.
   *
   * A different trust anchor from everything else here, and deliberately a
   * narrow one: these events are signed by each Mostro, so the check is that
   * the signature holds and the author is one of the instances the archive
   * named. Nothing else may put a row on the book or a line on the map.
   *
   * The query and the standing subscription share one filter, and `since`
   * bounds it at the panel's own window: a relay holding years of settled
   * trades must not send them all to fill a panel about now.
   */
  async function follow<T extends Revision>(
    owner: number,
    authors: readonly string[],
    kind: number,
    windowMs: number,
    parse: (event: Event) => T | null,
    into: Signal<readonly T[]>,
    ready: Signal<boolean>,
  ): Promise<void> {
    const known = new Set(authors)
    const held = new Map<string, T>()
    const filter = {
      kinds: [kind],
      authors: [...authors],
      since: Math.floor((Date.now() - windowMs) / 1000),
    }

    const take = (event: Event) => {
      if (!verifyFrom(event, known).ok) return
      const revision = parse(event)
      if (!revision) return
      // Addressable: an older revision alongside the current one is a relay
      // being normal, and must never undo a status.
      const current = held.get(keyOf(revision))
      if (current && !supersedes(revision, current)) return
      held.set(keyOf(revision), revision)
      into.value = [...held.values()]
    }

    // Standing before the query is awaited, and not after it: a revision
    // published in between would otherwise be lost until its instance
    // touched it again, which for a settled trade is never.
    liveUnsubscribe.push(
      relays.subscribe(filter, (event) => {
        take(event)
        refreshRelays()
      }),
    )

    const events = await relays.query(filter)
    // The set may have moved while the query was in flight; the newer watch
    // owns the signal and has already closed the subscription above, and this
    // one's events belong to nobody.
    if (owner !== generation) return
    refreshRelays()
    for (const event of events) take(event)
    ready.value = true
  }

  function closeLive(): void {
    for (const close of liveUnsubscribe) close()
    liveUnsubscribe = []
  }

  async function watchInstances(authors: readonly string[]): Promise<void> {
    const key = [...authors].sort().join(' ')
    if (key === watched) return
    watched = key
    const owner = ++generation

    closeLive()
    disputes.value = []
    orders.value = []
    disputesReady.value = false
    ordersReady.value = false
    if (authors.length === 0) {
      // Nothing to wait for: no instance to ask is an answered question.
      disputesReady.value = true
      ordersReady.value = true
      return
    }

    await Promise.all([
      follow(
        owner,
        authors,
        MOSTRO_DISPUTE_KIND,
        DISPUTES.windowMs,
        disputeFrom,
        disputes,
        disputesReady,
      ),
      follow(
        owner,
        authors,
        MOSTRO_ORDER_KIND,
        MAP.liveWindowMs,
        orderFrom,
        orders,
        ordersReady,
      ),
    ])
  }

  return {
    boot,
    documents,
    relays: relayStates,
    disputes,
    disputesReady,
    orders,
    ordersReady,

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

    watchInstances,

    stop() {
      unsubscribe?.()
      unsubscribe = null
      closeLive()
      disputesReady.value = false
      ordersReady.value = false
      watched = null
      generation += 1
      relays.close()
    },
  }
}
