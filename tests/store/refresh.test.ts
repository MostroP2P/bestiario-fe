import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type Event,
} from 'nostr-tools/pure'
import type { Filter } from 'nostr-tools'
import { createStore, type DocState } from '~/store/store'
import { clearCache } from '~/store/cache'
import type { Relays, RelayState } from '~/nostr/pool'
import type { IndexDoc } from '~/nostr/documents'

/**
 * A new index every few minutes is the normal life of the page (SPEC 6.3).
 * What a reader is looking at must not blink out while its replacement is in
 * the air: the verified figure stays until the next one is verified, and
 * only then is it swapped. Fail-closed still holds — a replacement that does
 * not verify takes the figure down.
 */

const DIR = 'tests/fixtures/snapshot'
const fixtures: Event[] = readdirSync(DIR)
  .filter((file) => file !== 'manifest.json')
  .map((file) => JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as Event)

const dOf = (event: Event) => event.tags.find((tag) => tag[0] === 'd')?.[1] ?? ''
const fixture = (d: string) => fixtures.find((event) => dOf(event) === d)!
const realIndex = JSON.parse(fixture('index').content) as IndexDoc
const hashOf = (d: string) => realIndex.documents.find((entry) => entry.d === d)!.hash

// The publisher's key cannot sign a replacement index, so this world is
// re-signed under a key the test holds. Contents are unchanged, so every
// hash in the real index still holds for the real payloads.
const secret = generateSecretKey()
const publisher = getPublicKey(secret)
const resign = (event: Event, overrides: Partial<Event> = {}): Event =>
  finalizeEvent(
    {
      kind: event.kind,
      created_at: overrides.created_at ?? event.created_at,
      tags: overrides.tags ?? event.tags,
      content: overrides.content ?? event.content,
    },
    secret,
  )

const indexV1 = resign(fixture('index'))
const ordersV1 = resign(fixture('orders:24h'))

/** The next snapshot: `orders:24h` now carries other figures and a new hash. */
const indexV2 = resign(fixture('index'), {
  created_at: indexV1.created_at + 300,
  content: JSON.stringify({
    ...realIndex,
    documents: realIndex.documents.map((entry) =>
      entry.d === 'orders:24h' ? { ...entry, hash: hashOf('orders:7d') } : entry,
    ),
  }),
})
const ordersV2 = resign(fixture('orders:7d'), {
  created_at: ordersV1.created_at + 300,
  tags: ordersV1.tags,
})

/** A relay whose holdings can change, which can stall, and which pushes the index. */
function liveRelays(initial: readonly Event[]) {
  let held = [...initial]
  let stalled = false
  let pushIndex: ((event: Event) => void) | null = null
  const waiting: (() => void)[] = []
  const documentQueries: Filter[] = []

  const relays: Relays = {
    query(filter) {
      const wanted = filter['#d']
      const events = held.filter((event) => !wanted || wanted.includes(dOf(event)))
      const isIndex = wanted?.length === 1 && wanted[0] === 'index'
      if (!isIndex) documentQueries.push(filter)
      if (isIndex || !stalled) return Promise.resolve(events)
      return new Promise<Event[]>((resolve) => waiting.push(() => resolve(events)))
    },
    subscribe(filter, onEvent) {
      if (filter['#d']?.includes('index')) pushIndex = onEvent
      return () => {}
    },
    states: (): RelayState[] => [{ url: 'wss://fake', status: 'live', newestAt: 1 }],
    close() {},
  }

  return {
    relays,
    documentQueries,
    publish(events: readonly Event[]) {
      held = [...held, ...events]
    },
    withdraw(d: string) {
      held = held.filter((event) => dOf(event) !== d)
    },
    stall() {
      stalled = true
    },
    answer() {
      waiting.splice(0).forEach((resolve) => resolve())
    },
    announce(index: Event) {
      pushIndex?.(index)
    },
  }
}

const payloadOf = (state: DocState | undefined) =>
  state && (state.status === 'live' || state.status === 'cached')
    ? state.envelope.payload
    : undefined

beforeEach(() => clearCache())
afterEach(() => clearCache())

describe('a replacement index', () => {
  test('keeps the verified figure on screen while its replacement is in the air', async () => {
    // Arrange
    const relay = liveRelays([indexV1, ordersV1])
    const store = createStore(relay.relays, publisher)
    await store.start()
    await store.need(['orders:24h'])
    const before = store.documents.value.get('orders:24h')
    const asked = relay.documentQueries.length

    // Act — the next snapshot lands, and the relay is slow to hand it over.
    relay.publish([indexV2, ordersV2])
    relay.stall()
    relay.announce(indexV2)
    await vi.waitFor(() => expect(relay.documentQueries.length).toBe(asked + 1))

    // Assert — no skeleton in between: the figure the reader had is still there.
    expect(store.documents.value.get('orders:24h')).toEqual(before)
  })

  test('swaps the figure in once the replacement verifies', async () => {
    // Arrange
    const relay = liveRelays([indexV1, ordersV1])
    const store = createStore(relay.relays, publisher)
    await store.start()
    await store.need(['orders:24h'])
    const before = payloadOf(store.documents.value.get('orders:24h'))
    const asked = relay.documentQueries.length

    // Act
    relay.publish([indexV2, ordersV2])
    relay.stall()
    relay.announce(indexV2)
    await vi.waitFor(() => expect(relay.documentQueries.length).toBe(asked + 1))
    relay.answer()

    // Assert
    await vi.waitFor(() => {
      const state = store.documents.value.get('orders:24h')
      expect(state?.status).toBe('live')
      if (state?.status !== 'live') return
      expect(state.createdAt).toBe(ordersV2.created_at)
      expect(state.envelope.payload).not.toEqual(before)
    })
  })

  test('takes the figure down when the replacement fails its proof', async () => {
    // Arrange — the relay only has the old document, which no longer hashes
    // to what the new index names.
    const relay = liveRelays([indexV1, ordersV1])
    const store = createStore(relay.relays, publisher)
    await store.start()
    await store.need(['orders:24h'])

    // Act
    relay.publish([indexV2])
    relay.announce(indexV2)

    // Assert
    await vi.waitFor(() =>
      expect(store.documents.value.get('orders:24h')).toEqual({
        status: 'unverified',
        reason: 'hash',
      }),
    )
  })

  test('says the replacement is unavailable when no relay returns it', async () => {
    // Arrange
    const relay = liveRelays([indexV1, ordersV1])
    const store = createStore(relay.relays, publisher)
    await store.start()
    await store.need(['orders:24h'])

    // Act
    relay.withdraw('orders:24h')
    relay.publish([indexV2])
    relay.announce(indexV2)

    // Assert
    await vi.waitFor(() =>
      expect(store.documents.value.get('orders:24h')).toEqual({ status: 'unavailable' }),
    )
  })
})
