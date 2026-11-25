/**
 * Window queries: a `since` with no `limit`, read whole from relays that cap
 * their answers by paging each relay newest first.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Event, Filter } from 'nostr-tools'
import { behaviour, event, resetBehaviour } from './fake-pool'

vi.mock('nostr-tools/pool', async () => ({
  SimplePool: (await import('./fake-pool')).FakePool,
}))

const { openRelays } = await import('~/nostr/pool')

const RELAYS = ['wss://one', 'wss://two']

beforeEach(resetBehaviour)

afterEach(() => vi.clearAllMocks())

describe('a window query against relays that cap their answers', () => {
  /** An order event, with an id unique to its relay, second and index. */
  function held(url: string, count: number, newest: number): Event[] {
    return Array.from({ length: count }, (_, i) => ({
      ...event(newest - i * 60),
      id: `${url}-${i}`,
      kind: 38383,
    }))
  }

  /**
   * relay.mostro.network answers at most 300 events per query: the oldest
   * from `since` without a `limit`, the newest with one.
   */
  function capped(store: Record<string, Event[]>, caps: Record<string, number>) {
    return (filter: Filter, relays: string[]) => {
      const url = relays[0]!
      const matching = (store[url] ?? [])
        .filter((e) => filter.since === undefined || e.created_at >= filter.since)
        .filter((e) => filter.until === undefined || e.created_at <= filter.until)
      const ordered = [...matching].sort((a, b) =>
        filter.limit === undefined
          ? a.created_at - b.created_at
          : b.created_at - a.created_at,
      )
      const cap = caps[url] ?? Infinity
      return Promise.resolve(ordered.slice(0, Math.min(cap, filter.limit ?? cap)))
    }
  }

  const NOW = 1_800_000_000

  test('reads the whole window from a relay that answers only part of it', async () => {
    // Arrange — ten events in the window, a relay that answers four a query.
    const store = { 'wss://one': held('wss://one', 10, NOW) }
    behaviour.query = capped(store, { 'wss://one': 4 })
    const relays = openRelays(['wss://one'])

    // Act
    const events = await relays.query({ kinds: [38383], since: NOW - 3600 })

    // Assert
    expect(events.map((e) => e.id).sort()).toEqual(
      store['wss://one'].map((e) => e.id).sort(),
    )
  })

  test('keeps the newest events, which one query from since would have missed', async () => {
    const store = { 'wss://one': held('wss://one', 10, NOW) }
    behaviour.query = capped(store, { 'wss://one': 4 })
    const relays = openRelays(['wss://one'])

    const events = await relays.query({ kinds: [38383], since: NOW - 3600 })

    expect(events.some((e) => e.created_at === NOW)).toBe(true)
  })

  test('pages each relay on its own, so a deeper relay leaves no gap in a shallower one', async () => {
    // Arrange — one relay caps at three, the other at five.
    const store = {
      'wss://one': held('wss://one', 9, NOW),
      'wss://two': held('wss://two', 9, NOW - 30),
    }
    behaviour.query = capped(store, { 'wss://one': 3, 'wss://two': 5 })
    const relays = openRelays(['wss://one', 'wss://two'])

    // Act
    const events = await relays.query({ kinds: [38383], since: NOW - 3600 })

    // Assert
    expect(events).toHaveLength(18)
  })

  test('stops at since, and never asks for what is older', async () => {
    const store = { 'wss://one': held('wss://one', 10, NOW) }
    behaviour.query = capped(store, { 'wss://one': 4 })
    const relays = openRelays(['wss://one'])

    const events = await relays.query({ kinds: [38383], since: NOW - 5 * 60 })

    expect(events.every((e) => e.created_at >= NOW - 5 * 60)).toBe(true)
    expect(events).toHaveLength(6)
  })

  test('stops when a page brings nothing new, so a relay that ignores until cannot loop', async () => {
    // Arrange — a relay that answers the same page whatever it is asked.
    const page = held('wss://one', 3, NOW)
    let calls = 0
    behaviour.query = () => {
      calls += 1
      return Promise.resolve(page)
    }
    const relays = openRelays(['wss://one'])

    // Act
    const events = await relays.query({ kinds: [38383], since: NOW - 3600 })

    // Assert — the first page, its repeat, and one step past the boundary.
    expect(events).toHaveLength(3)
    expect(calls).toBe(3)
  })

  test('steps past a second that fills a whole page, and still reads what is older', async () => {
    // Arrange — a cap of two, two events in the same second, two older ones.
    const at = (id: string, createdAt: number): Event => ({
      ...event(createdAt),
      id,
      kind: 38383,
    })
    const store = {
      'wss://one': [at('a', NOW), at('b', NOW), at('c', NOW - 60), at('d', NOW - 120)],
    }
    behaviour.query = capped(store, { 'wss://one': 2 })
    const relays = openRelays(['wss://one'])

    // Act
    const events = await relays.query({ kinds: [38383], since: NOW - 3600 })

    // Assert
    expect(events.map((e) => e.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  test('reads a relay that answers one event a query, second by second', async () => {
    const store = { 'wss://one': held('wss://one', 4, NOW) }
    behaviour.query = capped(store, { 'wss://one': 1 })
    const relays = openRelays(['wss://one'])

    const events = await relays.query({ kinds: [38383], since: NOW - 3600 })

    expect(events).toHaveLength(4)
  })

  test('does not step below since when the oldest page fills its second', async () => {
    // Arrange — the saturated second is since itself: nothing older belongs.
    const since = NOW - 3600
    const at = (id: string): Event => ({ ...event(since), id, kind: 38383 })
    const store = { 'wss://one': [at('a'), at('b'), at('c')] }
    const asked: Filter[] = []
    behaviour.query = (filter, urls) => {
      asked.push(filter)
      return capped(store, { 'wss://one': 2 })(filter, urls)
    }
    const relays = openRelays(['wss://one'])

    // Act
    await relays.query({ kinds: [38383], since })

    // Assert
    expect(asked.every((f) => f.until === undefined || f.until >= since)).toBe(true)
  })

  describe('the timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW * 1000)
    })
    afterEach(() => vi.useRealTimers())

    test('bounds the whole window read, not each page of it', async () => {
      // Arrange — a relay that takes three seconds a page, an eight-second budget.
      const store = { 'wss://one': held('wss://one', 20, NOW) }
      const waits: number[] = []
      const started = Date.now()
      // Like querySync: a page slower than its maxWait gives up at maxWait
      // with nothing, rather than taking as long as the relay does.
      behaviour.query = (filter, urls, opts) => {
        const maxWait = opts.maxWait ?? Infinity
        waits.push(maxWait)
        if (maxWait < 3_000) {
          vi.advanceTimersByTime(maxWait)
          return Promise.resolve([])
        }
        vi.advanceTimersByTime(3_000)
        return capped(store, { 'wss://one': 2 })(filter, urls)
      }
      const relays = openRelays(['wss://one'])

      // Act
      const events = await relays.query({ kinds: [38383], since: NOW - 3600 }, 8_000)

      // Assert — the read ends at the budget, never past it. Each page gets
      // only what is left: two full pages fit, the third runs out of time,
      // and what the first two brought (two, then one new past the shared
      // second) is kept.
      expect(Date.now() - started).toBeLessThanOrEqual(8_000)
      expect(waits).toEqual([8_000, 5_000, 2_000])
      expect(events).toHaveLength(3)
    })
  })

  test('asks for no further page once the relays are closed', async () => {
    // Arrange — the relays are closed while the first page is in flight.
    const store = { 'wss://one': held('wss://one', 10, NOW) }
    let calls = 0
    const relays = openRelays(['wss://one'])
    behaviour.query = (filter, urls) => {
      calls += 1
      relays.close()
      return capped(store, { 'wss://one': 2 })(filter, urls)
    }

    // Act
    await relays.query({ kinds: [38383], since: NOW - 3600 })

    // Assert
    expect(calls).toBe(1)
  })

  test('calls every relay silent when none holds anything in the window', async () => {
    const relays = openRelays(RELAYS)

    const events = await relays.query({ kinds: [38383], since: NOW - 3600 })

    expect(events).toEqual([])
    expect(relays.states().map((s) => s.status)).toEqual(['silent', 'silent'])
  })

  test('keeps what one relay answered when another fails', async () => {
    behaviour.query = (filter, urls) =>
      urls[0] === 'wss://two'
        ? Promise.reject(new Error('socket hang up'))
        : capped({ 'wss://one': held('wss://one', 5, NOW) }, { 'wss://one': 2 })(
            filter,
            urls,
          )
    const relays = openRelays(['wss://one', 'wss://two'])

    const events = await relays.query({ kinds: [38383], since: NOW - 3600 })

    expect(events).toHaveLength(5)
    expect(relays.states().find((s) => s.url === 'wss://two')).toMatchObject({
      status: 'failed',
    })
    expect(relays.states().find((s) => s.url === 'wss://one')?.status).toBe('live')
  })
})
