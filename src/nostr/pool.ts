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
  /**
   * Every matching event any relay holds, within the timeout. A filter with
   * a `since` and no `limit` is a window, read newest page first however
   * little a relay answers per query, and whole up to one limit NIP-01 sets:
   * a filter has no offset, so when a relay holds more events in one second
   * than it answers per query, the ones past its cap in that second are not
   * reached. Another relay, or the standing subscription, may still bring
   * them; nothing here can promise it.
   */
  query(filter: Filter, timeoutMs?: number): Promise<Event[]>
  /** A standing subscription. Returns the unsubscribe. */
  subscribe(filter: Filter, onEvent: (event: Event) => void): () => void
  /** Per-relay connection state, for the trust panel. */
  states(): RelayState[]
  close(): void
}

/**
 * How many events a window query asks one relay for at a time.
 *
 * A relay answers at most its own cap per query whatever `limit` says —
 * relay.mostro.network stops at 300 — and without a `limit` it answers the
 * *oldest* events from `since`. A window read in one query then misses its
 * newest end, which for a live map is the only end that matters. So a window
 * is read newest first, a page at a time, each relay on its own.
 */
const WINDOW_PAGE = 500

/** A ceiling on pages per relay, so a misbehaving relay cannot hold a query open. */
const MAX_WINDOW_PAGES = 40

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

  const markSilent = () => {
    for (const [url, state] of states) {
      if (state.status === 'connecting') states.set(url, { ...state, status: 'silent' })
    }
  }

  const markFailed = (urls: readonly string[], error: unknown) => {
    const message = error instanceof Error ? error.message : 'unknown error'
    for (const url of urls) {
      const state = states.get(url)
      if (state) states.set(url, { ...state, status: 'failed', error: message })
    }
  }

  // Set by `close()`. A window read awaits one page at a time, and a page
  // asked after close would have SimplePool dial the relay all over again.
  let closed = false

  /**
   * One relay's whole window, newest page first, each page ending where the
   * last one's oldest event was. `until` is inclusive, so a second shared by
   * two pages is asked twice and deduplicated rather than skipped.
   *
   * A page with nothing new means one of two things. Either the relay has
   * run out or ignores `until`, or the boundary second alone fills a page,
   * so asking it again can only return the same events. Both are handled by
   * one step to the second below. If that still brings nothing new, the walk
   * ends. Events past the relay's cap *within* that one second cannot be
   * reached: a NIP-01 filter has no offset. The step at least keeps
   * everything older than that second, and the other relays and the live
   * subscription may still supply what this one could not.
   *
   * Every page shares one deadline, so the whole window answers within the
   * caller's timeout, however slowly each page arrives.
   */
  async function readWindow(
    url: string,
    filter: Filter & { since: number },
    deadline: number,
  ): Promise<Event[]> {
    const seen = new Map<string, Event>()
    let until: number | undefined
    let stepped = false
    for (let page = 0; page < MAX_WINDOW_PAGES && !closed; page++) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) break
      const events = await pool.querySync(
        [url],
        { ...filter, limit: WINDOW_PAGE, ...(until === undefined ? {} : { until }) },
        { maxWait: remaining },
      )
      const fresh = events.filter((event) => !seen.has(event.id))
      if (fresh.length === 0) {
        if (stepped || until === undefined || until - 1 < filter.since) break
        until -= 1
        stepped = true
        continue
      }
      for (const event of fresh) seen.set(event.id, event)
      const oldest = Math.min(...events.map((event) => event.created_at))
      if (oldest <= filter.since) break
      until = oldest
      stepped = false
    }
    return [...seen.values()]
  }

  async function queryWindow(
    filter: Filter & { since: number },
    timeoutMs: number,
  ): Promise<Event[]> {
    const deadline = Date.now() + timeoutMs
    const answers = await Promise.all(
      relays.map(async (url) => {
        try {
          return await readWindow(url, filter, deadline)
        } catch (error: unknown) {
          markFailed([url], error)
          return []
        }
      }),
    )
    const merged = new Map<string, Event>()
    for (const event of answers.flat()) merged.set(event.id, event)
    const events = [...merged.values()]
    for (const event of events) sawEvent(event)
    if (events.length === 0) markSilent()
    return events
  }

  return {
    async query(filter, timeoutMs = TIMEOUTS.document) {
      if (filter.since !== undefined && filter.limit === undefined) {
        return queryWindow({ ...filter, since: filter.since }, timeoutMs)
      }
      try {
        const events = await pool.querySync(relays, filter, { maxWait: timeoutMs })
        for (const event of events) sawEvent(event)
        if (events.length === 0) markSilent()
        return events
      } catch (error: unknown) {
        markFailed(relays, error)
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
      closed = true
      pool.close(relays)
    },
  }
}
