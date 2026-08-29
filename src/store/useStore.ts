/**
 * The store, as a hook.
 *
 * One store per page: the relay connections and the cache are shared, and a
 * second pool would double the sockets for the same figures. The route says
 * which `d` values it needs and this asks for exactly those, once the index
 * is in — a reader who lands on one route downloads that and nothing else.
 */
import { useEffect, useMemo, useState } from 'preact/hooks'
import { DEFAULT_RELAYS, PUBLISHER_PUBKEY } from '~/config'
import { openRelays } from '~/nostr/pool'
import { createStore, type BootState, type DocState, type Store } from './store'
import type { RelayState } from '~/nostr/pool'
import type { LiveDispute } from '~/model/open-disputes'

let shared: Store | null = null

function sharedStore(): Store {
  shared ??= createStore(openRelays(DEFAULT_RELAYS), PUBLISHER_PUBKEY)
  return shared
}

/** Tests reach for this; the app never does. */
export function resetStore(): void {
  shared?.stop()
  shared = null
}

export type StoreView = {
  readonly boot: BootState
  readonly documents: ReadonlyMap<string, DocState>
  readonly relays: readonly RelayState[]
  readonly disputes: readonly LiveDispute[]
  /** False while the relays have not yet answered for the watched instances. */
  readonly disputesReady: boolean
}

/**
 * The documents a route needs, and — when it asks — the dispute events of the
 * instances it names. The second set is not addressed by `d`: it is the
 * instances' own live layer, and it is followed only while a view wants it.
 */
export function useStore(
  needed: readonly string[],
  disputeAuthors: readonly string[] = [],
): StoreView {
  const store = useMemo(() => sharedStore(), [])
  const [view, setView] = useState<StoreView>({
    boot: store.boot.value,
    documents: store.documents.value,
    relays: store.relays.value,
    disputes: store.disputes.value,
    disputesReady: store.disputesReady.value,
  })

  useEffect(() => {
    const read = () =>
      setView({
        boot: store.boot.value,
        documents: store.documents.value,
        relays: store.relays.value,
        disputes: store.disputes.value,
        disputesReady: store.disputesReady.value,
      })
    const stop = [
      store.boot.subscribe(read),
      store.documents.subscribe(read),
      store.relays.subscribe(read),
      store.disputes.subscribe(read),
      store.disputesReady.subscribe(read),
    ]
    void store.start()
    return () => stop.forEach((unsubscribe) => unsubscribe())
  }, [store])

  const key = needed.join(' ')
  useEffect(() => {
    if (store.boot.value.status !== 'ready') return
    void store.need(key.split(' ').filter(Boolean))
  }, [store, key, view.boot.status])

  // The instances are named by a document, so this list arrives on the second
  // render and not the first. Re-watching the same set is free.
  //
  // The store outlives any one view, so a view that asked for a watch releases
  // it on the way out: otherwise the overview's dispute subscription would
  // outlive the overview, and a reader on another route would keep paying for
  // traffic nothing renders. A view that named nobody holds nothing to release.
  const authorsKey = disputeAuthors.join(' ')
  useEffect(() => {
    const authors = authorsKey.split(' ').filter(Boolean)
    void store.watchDisputes(authors)
    if (authors.length === 0) return
    return () => {
      void store.watchDisputes([])
    }
  }, [store, authorsKey])

  return view
}

/** The verified payload for `d`, or undefined while it is not renderable. */
export function payloadOf(documents: ReadonlyMap<string, DocState>, d: string) {
  const state = documents.get(d)
  return state && (state.status === 'live' || state.status === 'cached')
    ? state.envelope.payload
    : undefined
}
