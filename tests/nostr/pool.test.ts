import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Event, Filter } from 'nostr-tools'

/** What the fake SimplePool will do. Set per test before opening relays. */
let behaviour: {
  query: (filter: Filter, relays: string[]) => Promise<Event[]>
  subscribeCalls: { filter: Filter; onevent: (event: Event) => void }[]
  closed: string[][]
  subscriptionsClosed: number
}

vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    querySync(relays: string[], filter: Filter) {
      return behaviour.query(filter, relays)
    }
    subscribe(
      _relays: string[],
      filter: Filter,
      handlers: { onevent: (e: Event) => void },
    ) {
      behaviour.subscribeCalls.push({ filter, onevent: handlers.onevent })
      return {
        close: () => {
          behaviour.subscriptionsClosed++
        },
      }
    }
    close(relays: string[]) {
      behaviour.closed.push(relays)
    }
  },
}))

const { openRelays } = await import('~/nostr/pool')

const RELAYS = ['wss://one', 'wss://two']

function event(createdAt: number): Event {
  return {
    id: 'x',
    pubkey: 'p',
    created_at: createdAt,
    kind: 30666,
    tags: [['d', 'index']],
    content: '{}',
    sig: 's',
  }
}

beforeEach(() => {
  behaviour = {
    query: () => Promise.resolve([]),
    subscribeCalls: [],
    closed: [],
    subscriptionsClosed: 0,
  }
})

afterEach(() => vi.clearAllMocks())

describe('openRelays', () => {
  test('starts with every relay connecting and nothing heard from', () => {
    const relays = openRelays(RELAYS)

    expect(relays.states()).toEqual([
      { url: 'wss://one', status: 'connecting', newestAt: null },
      { url: 'wss://two', status: 'connecting', newestAt: null },
    ])
  })

  test('returns what the relays hold', async () => {
    // Arrange
    behaviour.query = () => Promise.resolve([event(100)])
    const relays = openRelays(RELAYS)

    // Act
    const events = await relays.query({ kinds: [30666] })

    // Assert
    expect(events).toHaveLength(1)
  })

  test('records the newest event a relay supplied, for the age on screen', async () => {
    behaviour.query = () => Promise.resolve([event(100), event(400), event(250)])
    const relays = openRelays(RELAYS)

    await relays.query({ kinds: [30666] })

    for (const state of relays.states()) {
      expect(state.status).toBe('live')
      expect(state.newestAt).toBe(400)
    }
  })

  test('calls a relay silent when it answers with nothing', async () => {
    // Silence is not failure: a relay may simply not hold the document.
    const relays = openRelays(RELAYS)

    await relays.query({ kinds: [30666] })

    expect(relays.states().map((s) => s.status)).toEqual(['silent', 'silent'])
  })

  test('does not downgrade a relay that has already answered', async () => {
    behaviour.query = () => Promise.resolve([event(100)])
    const relays = openRelays(RELAYS)
    await relays.query({ kinds: [30666] })

    behaviour.query = () => Promise.resolve([])
    await relays.query({ kinds: [30666] })

    expect(relays.states().map((s) => s.status)).toEqual(['live', 'live'])
  })

  test('reports a failure with its reason and returns no events', async () => {
    behaviour.query = () => Promise.reject(new Error('socket hang up'))
    const relays = openRelays(RELAYS)

    const events = await relays.query({ kinds: [30666] })

    expect(events).toEqual([])
    expect(relays.states()[0]).toMatchObject({
      status: 'failed',
      error: 'socket hang up',
    })
  })

  test('survives a rejection that is not an Error', async () => {
    // A relay library that throws a string is exactly what the fallback
    // exists for, so the test has to be able to produce one.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    behaviour.query = () => Promise.reject('nope')
    const relays = openRelays(RELAYS)

    await relays.query({ kinds: [30666] })

    expect(relays.states()[0]).toMatchObject({ status: 'failed', error: 'unknown error' })
  })

  test('leaves a failed relay failed rather than reviving it on silence', async () => {
    behaviour.query = () => Promise.reject(new Error('down'))
    const relays = openRelays(RELAYS)
    await relays.query({ kinds: [30666] })

    behaviour.query = () => Promise.resolve([event(10)])
    await relays.query({ kinds: [30666] })

    expect(relays.states().map((s) => s.status)).toEqual(['failed', 'failed'])
  })
})

describe('subscriptions', () => {
  test('passes events through and records having heard them', () => {
    // Arrange
    const relays = openRelays(RELAYS)
    const seen: Event[] = []

    // Act
    relays.subscribe({ kinds: [30666] }, (e) => seen.push(e))
    behaviour.subscribeCalls[0]!.onevent(event(900))

    // Assert
    expect(seen).toHaveLength(1)
    expect(relays.states()[0]).toMatchObject({ status: 'live', newestAt: 900 })
  })

  test('closes the subscription when told to', () => {
    const relays = openRelays(RELAYS)

    relays.subscribe({ kinds: [30666] }, () => {})()

    expect(behaviour.subscriptionsClosed).toBe(1)
  })
})

describe('close', () => {
  test('closes every relay it opened', () => {
    const relays = openRelays(RELAYS)

    relays.close()

    expect(behaviour.closed).toEqual([RELAYS])
  })
})

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

    // Assert
    expect(events).toHaveLength(3)
    expect(calls).toBe(2)
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
