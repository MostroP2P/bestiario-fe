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
}

export function useStore(needed: readonly string[]): StoreView {
  const store = useMemo(() => sharedStore(), [])
  const [view, setView] = useState<StoreView>({
    boot: store.boot.value,
    documents: store.documents.value,
    relays: store.relays.value,
  })

  useEffect(() => {
    const read = () =>
      setView({
        boot: store.boot.value,
        documents: store.documents.value,
        relays: store.relays.value,
      })
    const stop = [
      store.boot.subscribe(read),
      store.documents.subscribe(read),
      store.relays.subscribe(read),
    ]
    void store.start()
    return () => stop.forEach((unsubscribe) => unsubscribe())
  }, [store])

  const key = needed.join(' ')
  useEffect(() => {
    if (store.boot.value.status !== 'ready') return
    void store.need(key.split(' ').filter(Boolean))
  }, [store, key, view.boot.status])

  return view
}

/** The verified payload for `d`, or undefined while it is not renderable. */
export function payloadOf(documents: ReadonlyMap<string, DocState>, d: string) {
  const state = documents.get(d)
  return state && (state.status === 'live' || state.status === 'cached')
    ? state.envelope.payload
    : undefined
}
