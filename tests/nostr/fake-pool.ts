/**
 * A stand-in for nostr-tools' SimplePool, shared by the relay-layer tests.
 *
 * A test file installs it with
 * `vi.mock('nostr-tools/pool', async () => ({ SimplePool: (await import('./fake-pool')).FakePool }))`
 * and sets `behaviour` before opening relays. `resetBehaviour()` runs before
 * each test so no file inherits another's relay.
 */
import type { Event, Filter } from 'nostr-tools'

export type QueryOptions = { maxWait?: number }

/** What the fake SimplePool will do. Set per test before opening relays. */
export const behaviour: {
  query: (filter: Filter, relays: string[], opts: QueryOptions) => Promise<Event[]>
  subscribeCalls: { filter: Filter; onevent: (event: Event) => void }[]
  closed: string[][]
  subscriptionsClosed: number
} = {
  query: () => Promise.resolve([]),
  subscribeCalls: [],
  closed: [],
  subscriptionsClosed: 0,
}

export function resetBehaviour(): void {
  behaviour.query = () => Promise.resolve([])
  behaviour.subscribeCalls = []
  behaviour.closed = []
  behaviour.subscriptionsClosed = 0
}

export class FakePool {
  querySync(relays: string[], filter: Filter, opts: QueryOptions = {}) {
    return behaviour.query(filter, relays, opts)
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
}

export function event(createdAt: number): Event {
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
