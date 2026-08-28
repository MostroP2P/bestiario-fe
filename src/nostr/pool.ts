/**
 * The connection to the relays.
 *
 * A thin seam, on purpose: everything between the socket and a rendered
 * figure is a pure function of the bytes received (SPEC 7.1), and that is
 * only true if the socket itself is something a test can replace. The store
 * depends on [`Relays`] and never on `SimplePool`.
 *
 * Each relay is dialled independently. One that is down, slow, or serving
 * nothing never blocks another: a relay can withhold an event but cannot
 * forge one past verification, so its silence costs latency and never trust.
 */
import { SimplePool } from 'nostr-tools/pool'
import type { Event, Filter } from 'nostr-tools'
import { TIMEOUTS } from '~/config'

export type RelayStatus = 'connecting' | 'live' | 'silent' | 'failed'

export type RelayState = {
  readonly url: string
  readonly status: RelayStatus
  /** `created_at` of the newest event this relay supplied, in seconds. */
  readonly newestAt: number | null
  readonly error?: string
}

export interface Relays {
  /** Every matching event any relay holds, within the timeout. */
  query(filter: Filter, timeoutMs?: number): Promise<Event[]>
  /** A standing subscription. Returns the unsubscribe. */
  subscribe(filter: Filter, onEvent: (event: Event) => void): () => void
  /** Per-relay connection state, for the trust panel. */
  states(): RelayState[]
  close(): void
}

export function openRelays(urls: readonly string[]): Relays {
  const pool = new SimplePool()
  const relays = [...urls]
  const states = new Map<string, RelayState>(
    relays.map((url) => [url, { url, status: 'connecting' as const, newestAt: null }]),
  )

  // Which relay supplied an event is not on the event, and SimplePool does
  // not say. What can be recorded is that *somebody* answered, so a relay
  // stays `connecting` until its own socket reports otherwise.
  const sawEvent = (event: Event) => {
    for (const [url, state] of states) {
      if (state.status === 'failed') continue
      states.set(url, {
        url,
        status: 'live',
        newestAt: Math.max(state.newestAt ?? 0, event.created_at),
      })
    }
  }

  return {
    async query(filter, timeoutMs = TIMEOUTS.document) {
      try {
        const events = await pool.querySync(relays, filter, { maxWait: timeoutMs })
        for (const event of events) sawEvent(event)
        if (events.length === 0) {
          for (const [url, state] of states) {
            if (state.status === 'connecting') states.set(url, { ...state, status: 'silent' })
          }
        }
        return events
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'unknown error'
        for (const [url, state] of states) {
          states.set(url, { ...state, status: 'failed', error: message })
        }
        return []
      }
    },

    subscribe(filter, onEvent) {
      const subscription = pool.subscribe(relays, filter, {
        onevent(event) {
          sawEvent(event)
          onEvent(event)
        },
      })
      return () => subscription.close()
    },

    states() {
      return [...states.values()]
    },

    close() {
      pool.close(relays)
    },
  }
}
