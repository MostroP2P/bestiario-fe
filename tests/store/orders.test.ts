import { describe, expect, test } from 'vitest'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import type { Event, Filter } from 'nostr-tools'
import { createStore } from '~/store/store'
import { MAP, MOSTRO_ORDER_KIND, PUBLISHER_PUBKEY } from '~/config'
import type { Relays, RelayState } from '~/nostr/pool'

/**
 * The map's live layer, as the store holds it: the instances' own order
 * events, newest revision per order, from the instances the archive names
 * and nobody else.
 */

const SECRET = generateSecretKey()
const INSTANCES = [getPublicKey(SECRET)]

function orderEvent(
  over: { secret?: Uint8Array; id?: string; status?: string; createdAt?: number } = {},
): Event {
  return finalizeEvent(
    {
      kind: MOSTRO_ORDER_KIND,
      created_at: over.createdAt ?? Math.floor(Date.now() / 1000),
      tags: [
        ['d', over.id ?? 'order-1'],
        ['k', 'sell'],
        ['f', 'ARS'],
        ['s', over.status ?? 'in-progress'],
        ['z', 'order'],
      ],
      content: '',
    },
    over.secret ?? SECRET,
  )
}

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
      if (!filter.kinds?.includes(MOSTRO_ORDER_KIND)) return () => {}
      push = onEvent
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

describe('the live order layer', () => {
  test('asks the instances for their own order events of the live window', async () => {
    // Arrange
    const pool = fakeRelays()
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)

    // Act
    await subject.watchInstances(INSTANCES)

    // Assert
    const asked = pool.filters.find((filter) => filter.kinds?.includes(MOSTRO_ORDER_KIND))
    expect(asked?.authors).toEqual(INSTANCES)
    const expected = (Date.now() - MAP.liveWindowMs) / 1000
    expect(Math.abs((asked?.since ?? 0) - expected)).toBeLessThan(5)
  })

  test('holds the orders the instances signed, and says it has heard back', async () => {
    const pool = fakeRelays([orderEvent({ id: 'a' }), orderEvent({ id: 'b' })])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    expect(subject.ordersReady.value).toBe(false)

    await subject.watchInstances(INSTANCES)

    expect(subject.orders.value.map((order) => order.id).sort()).toEqual(['a', 'b'])
    expect(subject.ordersReady.value).toBe(true)
  })

  test('refuses an order signed by somebody who is not one of the instances', async () => {
    const pool = fakeRelays([orderEvent({ secret: generateSecretKey() })])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)

    await subject.watchInstances(INSTANCES)

    expect(subject.orders.value).toEqual([])
  })

  test('takes a new status from the standing subscription, and keeps one entry', async () => {
    // Arrange
    const pool = fakeRelays([
      orderEvent({ id: 'a', status: 'in-progress', createdAt: 1_000 }),
    ])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchInstances(INSTANCES)

    // Act — the same order, completed a moment later.
    pool.send(orderEvent({ id: 'a', status: 'success', createdAt: 2_000 }))

    // Assert
    expect(subject.orders.value).toHaveLength(1)
    expect(subject.orders.value[0]?.status).toBe('success')
  })

  test('ignores a revision older than the one already held', async () => {
    const pool = fakeRelays([
      orderEvent({ id: 'a', status: 'canceled', createdAt: 2_000 }),
    ])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchInstances(INSTANCES)

    pool.send(orderEvent({ id: 'a', status: 'in-progress', createdAt: 1_000 }))

    expect(subject.orders.value[0]?.status).toBe('canceled')
  })

  test('drops what it held when the instances change', async () => {
    const pool = fakeRelays([orderEvent()])
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchInstances(INSTANCES)

    await subject.watchInstances([])

    expect(subject.orders.value).toEqual([])
    expect(pool.closedSubscriptions()).toBe(1)
  })

  test('stopping the store closes the order subscription', async () => {
    const pool = fakeRelays()
    const subject = createStore(pool.relays, PUBLISHER_PUBKEY)
    await subject.watchInstances(INSTANCES)

    subject.stop()

    expect(pool.closedSubscriptions()).toBe(1)
  })
})
