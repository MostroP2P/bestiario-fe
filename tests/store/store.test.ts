import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { finalizeEvent, generateSecretKey, type Event } from 'nostr-tools/pure'
import type { Filter } from 'nostr-tools'
import { createStore } from '~/store/store'
import { clearCache } from '~/store/cache'
import { PUBLISHER_PUBKEY } from '~/config'
import type { Relays, RelayState } from '~/nostr/pool'
import type { IndexDoc } from '~/nostr/documents'

const DIR = 'tests/fixtures/snapshot'

const fixtures: Event[] = readdirSync(DIR)
  .filter((file) => file !== 'manifest.json')
  .map((file) => JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as Event)

const dOf = (event: Event) => event.tags.find((tag) => tag[0] === 'd')?.[1] ?? ''
const indexEvent = fixtures.find((event) => dOf(event) === 'index')!
const index = JSON.parse(indexEvent.content) as IndexDoc

/** A relay that holds exactly what it is given, and counts what is asked. */
function fakeRelays(events: readonly Event[]): Relays & { queries: Filter[] } {
  const queries: Filter[] = []
  return {
    queries,
    query(filter) {
      queries.push(filter)
      const wanted = filter['#d']
      return Promise.resolve(
        events.filter((event) => !wanted || wanted.includes(dOf(event))),
      )
    },
    subscribe() {
      return () => {}
    },
    states(): RelayState[] {
      return [{ url: 'wss://fake', status: 'live', newestAt: 1 }]
    },
    close() {},
  }
}

/** A relay that answers nothing, as two dead relays do. */
function silentRelays(): Relays {
  return {
    query: () => Promise.resolve([]),
    subscribe: () => () => {},
    states: () => [],
    close() {},
  }
}

beforeEach(() => clearCache())
afterEach(() => clearCache())

describe('boot', () => {
  test('reaches a verified index', async () => {
    // Arrange
    const store = createStore(fakeRelays(fixtures), PUBLISHER_PUBKEY)

    // Act
    await store.start()

    // Assert
    expect(store.boot.value.status).toBe('ready')
    if (store.boot.value.status === 'ready') {
      expect(store.boot.value.index.snapshot_id).toBe(index.snapshot_id)
      expect(store.boot.value.createdAt).toBe(indexEvent.created_at)
    }
  })

  test('is fatal when no relay answers', async () => {
    const store = createStore(silentRelays(), PUBLISHER_PUBKEY)

    await store.start()

    expect(store.boot.value).toEqual({ status: 'failed', reason: 'timeout' })
  })

  test('is fatal when the index is signed by somebody else', async () => {
    // Arrange — a real index, re-signed by a key nobody trusts.
    const key = generateSecretKey()
    const impostor = finalizeEvent(
      {
        kind: 30666,
        created_at: indexEvent.created_at,
        tags: indexEvent.tags,
        content: indexEvent.content,
      },
      key,
    )
    const store = createStore(fakeRelays([impostor]), PUBLISHER_PUBKEY)

    // Act
    await store.start()

    // Assert
    expect(store.boot.value).toEqual({ status: 'failed', reason: 'author' })
  })

  test('keeps the newest index when relays disagree', async () => {
    const stale = { ...indexEvent, created_at: indexEvent.created_at - 3600 }
    const store = createStore(fakeRelays([stale, indexEvent]), PUBLISHER_PUBKEY)

    await store.start()

    if (store.boot.value.status !== 'ready') throw new Error('not ready')
    expect(store.boot.value.createdAt).toBe(indexEvent.created_at)
  })
})

describe('documents', () => {
  test('verifies and holds what a route asks for', async () => {
    // Arrange
    const store = createStore(fakeRelays(fixtures), PUBLISHER_PUBKEY)
    await store.start()

    // Act
    await store.need(['orders:24h', 'volume:all'])

    // Assert
    const held = store.documents.value
    expect(held.get('orders:24h')?.status).toBe('live')
    expect(held.get('volume:all')?.status).toBe('live')
  })

  test('asks for everything a route needs in one round trip', async () => {
    const relays = fakeRelays(fixtures)
    const store = createStore(relays, PUBLISHER_PUBKEY)
    await store.start()
    const before = relays.queries.length

    await store.need(['orders:24h', 'volume:24h', 'disputes:24h', 'dev-fees:24h'])

    expect(relays.queries.length - before).toBe(1)
  })

  test('marks a document no relay returned as unavailable, not unverified', async () => {
    // A relay's silence and a failed proof are different facts.
    const store = createStore(fakeRelays([indexEvent]), PUBLISHER_PUBKEY)
    await store.start()

    await store.need(['orders:24h'])

    expect(store.documents.value.get('orders:24h')).toEqual({ status: 'unavailable' })
  })

  test('marks a document the index does not name as unavailable', async () => {
    // `instances:30d` is in the grammar and is not published today.
    const store = createStore(fakeRelays(fixtures), PUBLISHER_PUBKEY)
    await store.start()

    await store.need(['instances:30d'])

    expect(store.documents.value.get('instances:30d')).toEqual({ status: 'unavailable' })
  })

  test('marks a document signed by another key as unverified, and renders no figure', async () => {
    // Arrange
    const real = fixtures.find((event) => dOf(event) === 'orders:24h')!
    const key = generateSecretKey()
    const impostor = finalizeEvent(
      {
        kind: 30666,
        created_at: real.created_at,
        tags: real.tags,
        content: real.content,
      },
      key,
    )
    const store = createStore(fakeRelays([indexEvent, impostor]), PUBLISHER_PUBKEY)
    await store.start()

    // Act
    await store.need(['orders:24h'])

    // Assert
    expect(store.documents.value.get('orders:24h')).toEqual({
      status: 'unverified',
      reason: 'author',
    })
  })

  test('marks a document whose payload does not hash to the index as unverified', async () => {
    // Arrange — correctly signed, but by the publisher for another snapshot.
    const real = fixtures.find((event) => dOf(event) === 'orders:24h')!
    const otherPayload = fixtures.find((event) => dOf(event) === 'orders:7d')!
    const swapped: Event = { ...real, content: otherPayload.content }
    const store = createStore(fakeRelays([indexEvent, swapped]), PUBLISHER_PUBKEY)
    await store.start()

    // Act
    await store.need(['orders:24h'])

    // Assert — the signature is what fails first here, which is still a
    // refusal to render and is reported as what it is.
    const state = store.documents.value.get('orders:24h')
    expect(state?.status).toBe('unverified')
  })
})

describe('the cache', () => {
  test('serves a second visit without asking a relay again', async () => {
    // Arrange
    const relays = fakeRelays(fixtures)
    const first = createStore(relays, PUBLISHER_PUBKEY)
    await first.start()
    await first.need(['orders:24h'])
    const asked = relays.queries.length

    // Act — a fresh store, the same storage.
    const second = createStore(relays, PUBLISHER_PUBKEY)
    await second.start()
    await second.need(['orders:24h'])

    // Assert — the index was fetched again; the document was not.
    expect(relays.queries.length).toBe(asked + 1)
    expect(second.documents.value.get('orders:24h')?.status).toBe('cached')
  })

  test('never serves a cached document whose hash the index no longer names', async () => {
    // Arrange — cache it, then move the index's hash for it.
    const relays = fakeRelays(fixtures)
    const first = createStore(relays, PUBLISHER_PUBKEY)
    await first.start()
    await first.need(['orders:24h'])

    const moved: IndexDoc = {
      ...index,
      documents: index.documents.map((entry) =>
        entry.d === 'orders:24h' ? { ...entry, hash: 'f'.repeat(64) } : entry,
      ),
    }
    const key = generateSecretKey()
    const movedEvent = finalizeEvent(
      {
        kind: 30666,
        created_at: indexEvent.created_at + 1,
        tags: indexEvent.tags,
        content: JSON.stringify(moved),
      },
      key,
    )

    // Act — a store trusting *that* publisher, so the index verifies.
    const publisher = movedEvent.pubkey
    const others = fixtures.filter((event) => dOf(event) !== 'index')
    const second = createStore(fakeRelays([movedEvent, ...others]), publisher)
    await second.start()
    await second.need(['orders:24h'])

    // Assert — the cached payload was not promoted to the screen.
    expect(second.documents.value.get('orders:24h')?.status).not.toBe('cached')
  })
})
