import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/preact'
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type Event,
} from 'nostr-tools/pure'
import type { Filter } from 'nostr-tools'
import { canonicalPayload } from '~/nostr/canonical'
import { sha256Hex } from '~/nostr/hash'
import type { Metric, WindowPayload } from '~/nostr/documents'

/**
 * Overview · the typical time to complete, in the orders summary.
 *
 * The figure the orders view leads with is also a row of the overview's
 * ORDERS block, beside DISPUTES · DEV FEES. It is the network's: the
 * overview reads the network `orders:<w>` document, which is the only one
 * that signs it.
 */

const KEY = generateSecretKey()

vi.mock('~/config', async (importOriginal) => {
  const actual: object = await importOriginal()
  return { ...actual, PUBLISHER_PUBKEY: getPublicKey(KEY_FOR_MOCK) }
})

var KEY_FOR_MOCK = KEY // eslint-disable-line no-var

const RANGE = { from: '2026-08-01T00:00:00+00:00', until: '2026-08-28T00:00:00+00:00' }

const metric = (name: string, unit: Metric['unit'], value: Metric['value']): Metric => ({
  name,
  kind: 'observed',
  unit,
  value,
})
const count = (name: string, value: number) => metric(name, 'count', value)
const seconds = (name: string, value: number) => metric(name, 'seconds', value)

const EMPTY: WindowPayload = { range: RANGE, metrics: [] }

/** The four family documents and the instance set, for one window. */
const windowOf = (
  w: string,
  orders: readonly Metric[],
): Record<string, WindowPayload> => ({
  [`orders:${w}`]: {
    range: RANGE,
    metrics: [
      count('orders.created', 1500),
      count('orders.completed', 1204),
      count('orders.canceled', 101),
      ...orders,
    ],
  },
  [`volume:${w}`]: EMPTY,
  [`disputes:${w}`]: EMPTY,
  [`dev-fees:${w}`]: EMPTY,
  [`instances:${w}`]: EMPTY,
})

const DOCS: Record<string, WindowPayload> = {
  ...windowOf('30d', [
    count('timing.time_to_complete_samples', 20),
    seconds('timing.time_to_complete_p50', 486),
    seconds('timing.time_to_complete_p90', 1630),
  ]),
  // A window in which no trade could be timed.
  ...windowOf('7d', [
    count('timing.time_to_complete_samples', 0),
    metric('timing.time_to_complete_p50', 'missing', null),
    metric('timing.time_to_complete_p90', 'missing', null),
  ]),
  // A snapshot from before bestiario published durations.
  ...windowOf('24h', []),
}

let events: Event[] = []

async function buildSnapshot(): Promise<Event[]> {
  const now = Math.floor(Date.now() / 1000)
  const documents: { d: string; hash: string; revision: number; updated_at: string }[] =
    []
  const signed: Event[] = []

  for (const [d, payload] of Object.entries(DOCS)) {
    const hash = await sha256Hex(canonicalPayload(payload))
    documents.push({ d, hash, revision: 1, updated_at: RANGE.until })
    signed.push(
      finalizeEvent(
        {
          kind: 30666,
          created_at: now,
          tags: [['d', d]],
          content: JSON.stringify({
            schema_version: 1,
            snapshot_id: 'TEST',
            generated_at: RANGE.until,
            revision: 1,
            payload,
          }),
        },
        KEY,
      ),
    )
  }

  signed.push(
    finalizeEvent(
      {
        kind: 30666,
        created_at: now,
        tags: [['d', 'index']],
        content: JSON.stringify({
          schema_version: 1,
          snapshot_id: 'TEST',
          generated_at: RANGE.until,
          publisher: { name: 'bestiario', version: 'test' },
          coverage: { first_event_at: RANGE.from, last_event_at: RANGE.until },
          resolutions: {},
          documents,
        }),
      },
      KEY,
    ),
  )
  return signed
}

const dOf = (event: Event) => event.tags.find((tag) => tag[0] === 'd')?.[1] ?? ''

vi.mock('~/nostr/pool', () => ({
  openRelays: () => ({
    query: (filter: Filter) => {
      // Mostro's own dispute events are asked for by kind; none are served.
      if (!(filter.kinds ?? []).includes(30666)) return Promise.resolve([])
      const wanted = filter['#d']
      return Promise.resolve(events.filter((e) => !wanted || wanted.includes(dOf(e))))
    },
    subscribe: () => () => {},
    states: () => [{ url: 'wss://test', status: 'live', newestAt: 1 }],
    close: () => {},
  }),
}))

const { en } = await import('~/i18n/en')
const { formatMetric } = await import('~/model/format')
const { Overview } = await import('~/views/Overview')
const { resetStore } = await import('~/store/useStore')
const { clearCache } = await import('~/store/cache')
const { clearAtlasCache } = await import('~/map/useAtlas')

beforeAll(async () => {
  events = await buildSnapshot()
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  resetStore()
  clearCache()
  clearAtlasCache()
  // The map is not under test here; its geometry never arrives.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** As the page prints a figure, in whatever locale the run has. */
const printed = (unit: Metric['unit'], value: Metric['value']) =>
  formatMetric({ name: 'x', kind: 'observed', unit, value }).text

/** The block a heading names, and the row a label names inside it. */
function row(root: Element, heading: string, label: string): HTMLElement | null {
  for (const head of root.querySelectorAll('.b-section-head')) {
    if (head.textContent !== heading) continue
    for (const pair of head.parentElement?.querySelectorAll('.b-pair') ?? []) {
      if (pair.firstElementChild?.textContent === label) return pair as HTMLElement
    }
  }
  return null
}

const valueOf = (root: Element) =>
  row(root, en.pairs.ordersHeading, en.pairs.timeToComplete)?.lastElementChild
    ?.textContent

describe('Overview · time to complete', () => {
  test('shows the typical time to complete in the orders summary', async () => {
    // Arrange / Act
    const { container } = render(<Overview window="30d" />)

    // Assert
    await waitFor(() => {
      expect(valueOf(container)).toBe(printed('seconds', 486))
    })
  })

  test('renders a window with nothing timed as not measured, never as zero', async () => {
    // Arrange / Act
    const { container } = render(<Overview window="7d" />)

    // Assert
    await waitFor(() => {
      expect(valueOf(container)).toContain(en.absence.notMeasured)
    })
    expect(valueOf(container)).not.toContain(printed('seconds', 0))
  })

  test('renders a snapshot that predates the durations as not published', async () => {
    // Arrange / Act
    const { container } = render(<Overview window="24h" />)

    // Assert
    await waitFor(() => {
      expect(valueOf(container)).toContain(en.absence.notPublished)
    })
  })
})
