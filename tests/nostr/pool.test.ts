import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Event, Filter } from 'nostr-tools'

/** What the fake SimplePool will do. Set per test before opening relays. */
let behaviour: {
  query: (filter: Filter) => Promise<Event[]>
  subscribeCalls: { filter: Filter; onevent: (event: Event) => void }[]
  closed: string[][]
  subscriptionsClosed: number
}

vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    querySync(_relays: string[], filter: Filter) {
      return behaviour.query(filter)
    }
    subscribe(_relays: string[], filter: Filter, handlers: { onevent: (e: Event) => void }) {
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
    expect(relays.states()[0]).toMatchObject({ status: 'failed', error: 'socket hang up' })
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
