import { describe, expect, test } from 'vitest'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import type { Event, Filter } from 'nostr-tools'
import { createStore } from '~/store/store'
import { DISPUTES, MOSTRO_DISPUTE_KIND, PUBLISHER_PUBKEY } from '~/config'
import type { Relays, RelayState } from '~/nostr/pool'

const SECRETS = [generateSecretKey(), generateSecretKey()]
const INSTANCES = SECRETS.map((secret) => getPublicKey(secret))

function disputeEvent(
  over: {
    secret?: Uint8Array
    id?: string
    status?: string
    createdAt?: number
    kind?: number
  } = {},
): Event {
  const secret = over.secret ?? SECRETS[0]!
  return finalizeEvent(
    {
      kind: over.kind ?? MOSTRO_DISPUTE_KIND,
      created_at: over.createdAt ?? Math.floor(Date.now() / 1000),
      tags: [
        ['d', over.id ?? 'dispute-1'],
        ['s', over.status ?? 'initiated'],
        ['y', 'mostrop2p'],
        ['z', 'dispute'],
      ],
      content: '',
    },
    secret,
  )
}

/** A relay that answers a query with what it holds, and can push later. */
function fakeRelays(held: readonly Event[] = []) {
  const filters: Filter[] = []
  let push: ((event: Event) => void) | null = null
  let closed = 0
  const relays: Relays = {
    query(filter) {
      filters.push(filter)
      const kinds = filter.kinds ?? []
      return Promise.resolve(held.filter((event) => kinds.includes(event.kind)))
    },
    subscribe(filter, onEvent) {
      filters.push(filter)
      if (filter.kinds?.includes(MOSTRO_DISPUTE_KIND)) push = onEvent
      return () => {
        closed += 1
        push = null
      }
    },
    states: (): RelayState[] => [{ url: 'wss://fake', status: 'live', newestAt: 1 }],
    close() {},
  }
  return {
    relays,
    filters,
    send: (event: Event) => push?.(event),
    closedSubscriptions: () => closed,
  }
}

describe('the open dispute book', () => {
  test('asks the instances for their own dispute events of the last two days', async () => {
    // Arrange
    const pool = fakeRelays()
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)

    // Act
    await subject.watchDisputes(INSTANCES)

    // Assert
    const asked = pool.filters.find((filter) =>
      filter.kinds?.includes(MOSTRO_DISPUTE_KIND),
    )
    expect(asked?.authors).toEqual(INSTANCES)
    const since = asked?.since ?? 0
    const expected = (Date.now() - DISPUTES.windowMs) / 1000
    expect(Math.abs(since - expected)).toBeLessThan(5)
  })

  test('asks nothing when no instance is known', async () => {
    const pool = fakeRelays()
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)

    await subject.watchDisputes([])

    expect(pool.filters).toEqual([])
    expect(subject.disputes.value).toEqual([])
  })

  test('holds what the instances signed', async () => {
    // Arrange
    const pool = fakeRelays([
      disputeEvent({ id: 'a', status: 'initiated' }),
      disputeEvent({ id: 'b', status: 'in-progress', secret: SECRETS[1]! }),
    ])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)

    // Act
    await subject.watchDisputes(INSTANCES)

    // Assert
    expect(subject.disputes.value.map((dispute) => dispute.id).sort()).toEqual(['a', 'b'])
  })

  test('refuses an event signed by somebody who is not one of the instances', async () => {
    const stranger = generateSecretKey()
    const pool = fakeRelays([disputeEvent({ secret: stranger })])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)

    await subject.watchDisputes(INSTANCES)

    expect(subject.disputes.value).toEqual([])
  })

  test('refuses an event whose signature does not hold', async () => {
    // Arrange — the content is changed after signing, so the id and the
    // signature are of another event.
    const forged = { ...disputeEvent(), content: 'tampered' }
    const pool = fakeRelays([forged])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)

    // Act
    await subject.watchDisputes(INSTANCES)

    // Assert
    expect(subject.disputes.value).toEqual([])
  })

  test('takes a replacement from the standing subscription', async () => {
    // Arrange
    const opened = disputeEvent({ id: 'a', status: 'initiated', createdAt: 1_000 })
    const pool = fakeRelays([opened])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchDisputes(INSTANCES)
    expect(subject.disputes.value).toHaveLength(1)

    // Act — the same dispute, settled a moment later.
    pool.send(disputeEvent({ id: 'a', status: 'settled', createdAt: 2_000 }))

    // Assert — one entry, and no longer open.
    expect(subject.disputes.value).toHaveLength(1)
    expect(subject.disputes.value[0]?.status).toBe('settled')
  })

  test('ignores a revision older than the one already held', async () => {
    const pool = fakeRelays([
      disputeEvent({ id: 'a', status: 'in-progress', createdAt: 2_000 }),
    ])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchDisputes(INSTANCES)

    pool.send(disputeEvent({ id: 'a', status: 'initiated', createdAt: 1_000 }))

    expect(subject.disputes.value[0]?.status).toBe('in-progress')
  })

  test('watching the same instances again does not open a second subscription', async () => {
    const pool = fakeRelays()
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)

    await subject.watchDisputes(INSTANCES)
    await subject.watchDisputes([...INSTANCES].reverse())

    expect(
      pool.filters.filter((f) => f.kinds?.includes(MOSTRO_DISPUTE_KIND)),
    ).toHaveLength(
      2, // one query and one subscription, and no more
    )
  })

  test('stopping the store closes the dispute subscription', async () => {
    const pool = fakeRelays()
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchDisputes(INSTANCES)

    subject.stop()

    expect(pool.closedSubscriptions()).toBe(1)
  })
})
