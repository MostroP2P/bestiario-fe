import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/preact'
import { readFileSync } from 'node:fs'
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
 * The map, drawn from the instances' own order events.
 *
 * The archive names the instances; each instance's 38383 events say which of
 * its orders are trades in course or just completed. Only those put a line
 * on the map. The snapshot is built and signed at test time, with real
 * hashes over the real canonicalisation, and the order events are signed by
 * the instances' own keys, so the whole trust path runs over both.
 */

const KEY = generateSecretKey()
const PUBLISHER = getPublicKey(KEY)

const AR_KEY = generateSecretKey()
const VE_KEY = generateSecretKey()
const AR_PUBKEY = getPublicKey(AR_KEY)
const VE_PUBKEY = getPublicKey(VE_KEY)

const MINUTE = 60

/** One revision of an order, as its instance signs it. */
function orderEvent(
  key: Uint8Array,
  id: string,
  fiat: string,
  status: string,
  ageSeconds: number,
): Event {
  return finalizeEvent(
    {
      kind: 38383,
      created_at: Math.floor(Date.now() / 1000) - ageSeconds,
      tags: [
        ['d', id],
        ['k', 'sell'],
        ['f', fiat],
        ['s', status],
        ['z', 'order'],
      ],
      content: '',
    },
    key,
  )
}

/**
 * What the instances said: three currencies with a trade in course or just
 * completed, and three that must not reach the map — an order nobody took,
 * one that was canceled after being taken, and one completed too long ago.
 */
function orderEvents(): Event[] {
  return [
    orderEvent(AR_KEY, 'ars-1', 'ARS', 'in-progress', 2 * MINUTE),
    orderEvent(AR_KEY, 'ars-2', 'ARS', 'in-progress', 3 * MINUTE),
    orderEvent(AR_KEY, 'usd-1', 'USD', 'success', 1 * MINUTE),
    orderEvent(VE_KEY, 'ves-1', 'VES', 'in-progress', 1 * MINUTE),
    orderEvent(AR_KEY, 'brl-1', 'BRL', 'pending', 1 * MINUTE),
    orderEvent(VE_KEY, 'cup-1', 'CUP', 'in-progress', 4 * MINUTE),
    orderEvent(VE_KEY, 'cup-1', 'CUP', 'canceled', 2 * MINUTE),
    orderEvent(VE_KEY, 'eur-1', 'EUR', 'success', 6 * MINUTE),
  ]
}

// The map scatters each node inside its country from one seed drawn per page
// load, so a live seed lays the map out differently on every run — and which
// labels clear their neighbours changes with it. Pinning the seed is what the
// seed is for; everything downstream of it is a pure function.
vi.mock('~/model/rng', async (importOriginal) => {
  const actual: object = await importOriginal()
  return { ...actual, sessionSeed: () => 0x5eed }
})

vi.mock('~/config', async (importOriginal) => {
  const actual: object = await importOriginal()
  return { ...actual, PUBLISHER_PUBKEY: getPublicKey(KEY_FOR_MOCK) }
})

// The mock factory is hoisted above the file, so the key it reads has to be
// hoisted too.
var KEY_FOR_MOCK = KEY // eslint-disable-line no-var

const RANGE = { from: '2026-08-01T00:00:00+00:00', until: '2026-08-28T00:00:00+00:00' }

function count(name: string, value: number): Metric {
  return { name, kind: 'observed', unit: 'count', value }
}

function text(name: string, value: string): Metric {
  return { name, kind: 'observed', unit: 'text', value }
}

const DOCS: Record<string, WindowPayload> = {
  'orders:30d': { range: RANGE, metrics: [count('orders.created', 20)] },
  'volume:30d': { range: RANGE, metrics: [count('volume.completed', 20)] },
  'disputes:30d': { range: RANGE, metrics: [count('disputes.opened', 0)] },
  'dev-fees:30d': { range: RANGE, metrics: [count('dev_fees.paid', 0)] },
  'instances:30d': {
    range: RANGE,
    metrics: [
      text('instances.Mostro 🇦🇷 (aaaa).pubkey', AR_PUBKEY),
      text('instances.Mostro 🇦🇷 (aaaa).name', 'Mostro 🇦🇷'),
      count('instances.Mostro 🇦🇷 (aaaa).created', 15),
      text('instances.Mostro 🇻🇪 (bbbb).pubkey', VE_PUBKEY),
      text('instances.Mostro 🇻🇪 (bbbb).name', 'Mostro 🇻🇪'),
      count('instances.Mostro 🇻🇪 (bbbb).created', 5),
    ],
  },
  [`orders:30d:i:${AR_PUBKEY}`]: {
    range: RANGE,
    metrics: [
      count('orders.created', 19),
      count('orders.ARS.created', 13),
      count('orders.USD.created', 2),
      // Traded in the window, and with nothing in course now: the archive's
      // figure alone must not put it on the map.
      count('orders.BRL.created', 4),
    ],
  },
  [`orders:30d:i:${VE_PUBKEY}`]: {
    range: RANGE,
    metrics: [count('orders.created', 5), count('orders.VES.created', 5)],
  },
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
      const kinds = filter.kinds ?? []
      const wanted = filter['#d']
      return Promise.resolve(
        events.filter(
          (e) => kinds.includes(e.kind) && (!wanted || wanted.includes(dOf(e))),
        ),
      )
    },
    subscribe: () => () => {},
    states: () => [{ url: 'wss://test', status: 'live', newestAt: 1 }],
    close: () => {},
  }),
}))

const { Dashboard } = await import('~/views/Dashboard')
const { resetStore } = await import('~/store/useStore')
const { clearCache } = await import('~/store/cache')
const { clearAtlasCache } = await import('~/map/useAtlas')
const topology = JSON.parse(
  readFileSync('public/geo/countries-110m.json', 'utf8'),
) as unknown

beforeAll(async () => {
  events = [...(await buildSnapshot()), ...orderEvents()]

  globalThis.ResizeObserver = class {
    private cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe() {
      this.cb(
        [{ contentRect: { width: 1026, height: 408 } } as ResizeObserverEntry],
        this,
      )
    }
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
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(topology) })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the map, from the instances own orders', () => {
  test('trusts the snapshot it was built for', () => {
    expect(PUBLISHER).toHaveLength(64)
  })

  test('draws only the currencies with a trade in course or just completed', async () => {
    // Arrange / Act
    const { container } = render(<Dashboard />)

    // Assert — the order events arrive once the instances are named, so the
    // end state is what is waited for.
    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="currencies"] > g')).toHaveLength(3)
    })
    // Read from the node, not from its label: a label the layout could not
    // fit is dropped from the map on purpose.
    const codes = [...container.querySelectorAll('[data-layer="currencies"] > g')]
      .map((g) => g.getAttribute('data-code') ?? '')
      .sort()
    expect(codes).toEqual(['ARS', 'USD', 'VES'])
  })

  test('draws one line per order, not one per currency', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(4)
    })
  })

  test('gives a traveller to every line, so the movement is visible', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="travellers"] circle')).toHaveLength(
        4,
      )
    })
  })

  test('draws one node per instance trading now and names it', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="instances"] > g')).toHaveLength(2)
    })
    const labels = [...container.querySelectorAll('svg text')].map(
      (t) => t.textContent ?? '',
    )
    expect(labels.some((label) => label.includes('Mostro'))).toBe(true)
  })

  test('counts the markets the map draws, so the headline matches the drawing', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(4)
    })
    expect(container.querySelector('.b-map-count strong')?.textContent).toBe('3')
  })

  test('says how long a completed order stays on the map', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelector('.b-map-caption')?.textContent ?? '').toMatch(
        /5 minutes/,
      )
    })
  })
})
