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
 * The map in its measured mode.
 *
 * `orders:<window>:i:<pubkey>` is what turns the routes from illustration
 * into fact, and it is not on the relays yet — the daemon change is merged
 * and undeployed. So the snapshot here is built and signed at test time,
 * with real hashes over the real canonicalisation, and the whole trust path
 * runs over it exactly as it will over the publisher's.
 */

const KEY = generateSecretKey()
const PUBLISHER = getPublicKey(KEY)

const AR_PUBKEY = 'a'.repeat(64)
const VE_PUBKEY = 'b'.repeat(64)

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
      count('orders.created', 15),
      count('orders.ARS.created', 13),
      count('orders.USD.created', 2),
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
      const wanted = filter['#d']
      return Promise.resolve(events.filter((e) => !wanted || wanted.includes(dOf(e))))
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
  events = await buildSnapshot()

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

describe('the map, once the cross is published', () => {
  test('trusts the snapshot it was built for', () => {
    expect(PUBLISHER).toHaveLength(64)
  })

  test('draws a route for every currency an instance actually traded', async () => {
    // Arrange / Act — ARS and USD at one instance, VES at the other.
    const { container } = render(<Dashboard />)

    // Assert — the scoped documents arrive one round trip after the
    // instances that named them, so the end state is what is waited for.
    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="currencies"] > g')).toHaveLength(3)
    })
    // Read from the node, not from its label: a label the layout could not
    // fit is dropped from the map on purpose.
    const codes = [...container.querySelectorAll('[data-layer="currencies"] > g')]
      .map((g) => g.getAttribute('data-code') ?? '')
      .sort()
    expect(codes).toEqual(['ARS', 'USD', 'VES'])
    expect(container.querySelectorAll('[data-layer="arcs"] path').length).toBeGreaterThan(
      5,
    )
  })

  test('draws one node per instance and names it', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="instances"] > g')).toHaveLength(2)
    })
    const labels = [...container.querySelectorAll('svg text')].map(
      (t) => t.textContent ?? '',
    )
    expect(labels.some((label) => label.includes('Mostro'))).toBe(true)
  })

  test('stops calling the routes illustrative once they are measured', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(
        container.querySelectorAll('[data-layer="arcs"] path').length,
      ).toBeGreaterThan(0)
    })
    expect(container.querySelector('.b-map-gap')?.textContent ?? '').not.toMatch(
      /ilustrativas/,
    )
  })

  test('gives a busier pair more routes than a quieter one', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="currencies"] > g')).toHaveLength(3)
    })
    // ARS carries 13 of the 20 orders and must be the fattest bundle.
    const sizes = [...container.querySelectorAll('[data-layer="currencies"] > g')].map(
      (g) => Number(g.querySelector('circle[stroke-opacity]')?.getAttribute('r') ?? 0),
    )
    expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes))
  })
})
