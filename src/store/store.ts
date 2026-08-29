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
import { BESTIARIO_KIND, DISPUTES, MOSTRO_DISPUTE_KIND, TIMEOUTS } from '~/config'
import type { Relays, RelayState } from '~/nostr/pool'
import { verifyDocument, verifyFrom, verifyIndex, type Failure } from '~/nostr/verify'
import type { Envelope, IndexDoc, IndexEntry } from '~/nostr/documents'
import { disputeFrom } from '~/nostr/mostro'
import type { LiveDispute } from '~/model/open-disputes'
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
  /** Fetch the index and open the standing subscription to it. */
  start(): Promise<void>
  /** Ensure these `d` values are loaded, from cache where the hash matches. */
  need(ds: readonly string[]): Promise<void>
  /** Follow these instances' dispute events. Re-watching the same set is free. */
  watchDisputes(authors: readonly string[]): Promise<void>
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

  let unsubscribe: (() => void) | null = null
  let disputeUnsubscribe: (() => void) | null = null
  /** The instance set currently followed, as a stable key. */
  let watched = ''

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
   * Follow the instances' own dispute events (kind 38386).
   *
   * A different trust anchor from everything else here, and deliberately a
   * narrow one: these events are signed by each Mostro, so the check is that
   * the signature holds and the author is one of the instances the archive
   * named. Nothing else may put a row on the book.
   *
   * The query and the standing subscription share one filter, and `since`
   * bounds it at the book's own window: a relay holding years of settled
   * disputes must not send them all to fill a panel about now.
   */
  async function watchDisputes(authors: readonly string[]): Promise<void> {
    const key = [...authors].sort().join(' ')
    if (key === watched) return
    watched = key

    disputeUnsubscribe?.()
    disputeUnsubscribe = null
    disputes.value = []
    disputesReady.value = false
    if (authors.length === 0) {
      // Nothing to wait for: no instance to ask is an answered question.
      disputesReady.value = true
      return
    }

    const known = new Set(authors)
    const book = new Map<string, LiveDispute>()
    const filter = {
      kinds: [MOSTRO_DISPUTE_KIND],
      authors: [...authors],
      since: Math.floor((Date.now() - DISPUTES.windowMs) / 1000),
    }

    const take = (event: Event) => {
      if (!verifyFrom(event, known).ok) return
      const dispute = disputeFrom(event)
      if (!dispute) return
      // 38386 is addressable: an older revision alongside the current one is
      // a relay being normal, and must never undo a status.
      const id = `${dispute.instancePubkey}:${dispute.id}`
      const held = book.get(id)
      if (held && held.updatedAt >= dispute.updatedAt) return
      book.set(id, dispute)
      disputes.value = [...book.values()]
    }

    const events = await relays.query(filter)
    // The set may have moved while the query was in flight; the newer watch
    // owns the signal, and this one's events belong to nobody.
    if (watched !== key) return
    refreshRelays()
    for (const event of events) take(event)
    disputesReady.value = true

    disputeUnsubscribe = relays.subscribe(filter, (event) => {
      take(event)
      refreshRelays()
    })
  }

  return {
    boot,
    documents,
    relays: relayStates,
    disputes,
    disputesReady,

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

    watchDisputes,

    stop() {
      unsubscribe?.()
      unsubscribe = null
      disputeUnsubscribe?.()
      disputeUnsubscribe = null
      disputesReady.value = false
      watched = ''
      relays.close()
    },
  }
}
