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
function fakeRelays(held: readonly Event[] = [], options: { stall?: boolean } = {}) {
  const filters: Filter[] = []
  let push: ((event: Event) => void) | null = null
  let answer: (() => void) | null = null
  let closed = 0
  const relays: Relays = {
    query(filter) {
      filters.push(filter)
      const kinds = filter.kinds ?? []
      const events = held.filter((event) => kinds.includes(event.kind))
      // A relay that has not answered yet: the subscription has to be
      // standing before this settles, or a revision published in between is
      // lost until the instance speaks again.
      if (!options.stall) return Promise.resolve(events)
      return new Promise<Event[]>((resolve) => {
        answer = () => resolve(events)
      })
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
    isSubscribed: () => push !== null,
    answerQuery: () => answer?.(),
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

  test('is standing before the first query answers, so nothing falls in the gap', async () => {
    // Arrange — a relay that holds one dispute and has not answered yet.
    const opened = disputeEvent({ id: 'a', status: 'initiated', createdAt: 1_000 })
    const pool = fakeRelays([opened], { stall: true })
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    const watching = subject.watchDisputes(INSTANCES)
    await Promise.resolve()

    // Act — the instance publishes while the query is still in flight.
    expect(pool.isSubscribed()).toBe(true)
    pool.send(disputeEvent({ id: 'b', status: 'in-progress', createdAt: 1_500 }))
    pool.answerQuery()
    await watching

    // Assert — both the pushed revision and the query's own answer are held.
    expect(subject.disputes.value.map((dispute) => dispute.id).sort()).toEqual(['a', 'b'])
  })

  test('breaks a tie on the same second by the lowest event id', async () => {
    // Arrange — two revisions of one dispute in the same second. The lower id
    // is the one the protocol keeps, whichever a relay hands over first.
    const first = disputeEvent({ id: 'a', status: 'initiated', createdAt: 1_000 })
    const second = disputeEvent({ id: 'a', status: 'settled', createdAt: 1_000 })
    const [low, high] = [first, second].sort((x, y) => x.id.localeCompare(y.id))
    const pool = fakeRelays([high!])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchDisputes(INSTANCES)

    // Act — the lower id arrives second, and still wins.
    pool.send(low!)

    // Assert
    expect(subject.disputes.value[0]?.eventId).toBe(low!.id)
  })

  test('answers the empty set even when nothing has been watched yet', async () => {
    // The instances document can be unavailable or name nobody. An empty book
    // then is an answer, and the panel must stop being a skeleton.
    const pool = fakeRelays()
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    expect(subject.disputesReady.value).toBe(false)

    await subject.watchDisputes([])

    expect(subject.disputesReady.value).toBe(true)
  })

  test('stopping the store closes the dispute subscription', async () => {
    const pool = fakeRelays()
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchDisputes(INSTANCES)

    subject.stop()

    expect(pool.closedSubscriptions()).toBe(1)
  })
})
