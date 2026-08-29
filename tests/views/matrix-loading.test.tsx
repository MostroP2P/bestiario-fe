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
 * The cross while the second round is still in the air.
 *
 * `orders:<window>:i:<pubkey>` is fetched only after the instances document
 * names the pubkeys, so there is a stretch where the base figures are in and
 * the cross is not. Nothing published says the cross is empty during it, and
 * a half-arrived cross says an instance traded nothing. Both are claims the
 * archive has not made, so the block stays a skeleton until the scoped
 * documents settle.
 */

const KEY = generateSecretKey()
const PUBLISHER = getPublicKey(KEY)

const AR_PUBKEY = 'a'.repeat(64)
const VE_PUBKEY = 'b'.repeat(64)

vi.mock('~/config', async (importOriginal) => {
  const actual: object = await importOriginal()
  return { ...actual, PUBLISHER_PUBKEY: getPublicKey(KEY_FOR_MOCK) }
})

var KEY_FOR_MOCK = KEY // eslint-disable-line no-var

const RANGE = { from: '2026-08-01T00:00:00+00:00', until: '2026-08-28T00:00:00+00:00' }

const count = (name: string, value: number): Metric => ({
  name,
  kind: 'observed',
  unit: 'count',
  value,
})
const text = (name: string, value: string): Metric => ({
  name,
  kind: 'observed',
  unit: 'text',
  value,
})

const DOCS: Record<string, WindowPayload> = {
  'orders:30d': { range: RANGE, metrics: [count('orders.created', 20)] },
  'volume:30d': { range: RANGE, metrics: [count('volume.completed', 20)] },
  'disputes:30d': { range: RANGE, metrics: [count('disputes.opened', 0)] },
  'dev-fees:30d': { range: RANGE, metrics: [count('dev_fees.paid', 0)] },
  'instances:30d': {
    range: RANGE,
    metrics: [
      text('instances.Mostro AR.pubkey', AR_PUBKEY),
      text('instances.Mostro AR.name', 'Mostro AR'),
      count('instances.Mostro AR.created', 15),
      text('instances.Mostro VE.pubkey', VE_PUBKEY),
      text('instances.Mostro VE.name', 'Mostro VE'),
      count('instances.Mostro VE.created', 5),
    ],
  },
  [`orders:30d:i:${AR_PUBKEY}`]: {
    range: RANGE,
    metrics: [count('orders.created', 15), count('orders.ARS.created', 15)],
  },
  [`orders:30d:i:${VE_PUBKEY}`]: {
    range: RANGE,
    metrics: [count('orders.created', 5), count('orders.VES.created', 5)],
  },
}

let events: Event[] = []

/** Held until the test lets the slower half of the second round answer. */
let release: () => void = () => {}
const held = new Promise<void>((resolve) => {
  release = resolve
})

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
    query: async (filter: Filter) => {
      const wanted = filter['#d']
      // The scoped round is the one the test holds: the base documents land
      // first, exactly as they do against a real relay.
      if (wanted?.some((d) => d.includes(':i:'))) await held
      return events.filter((e) => !wanted || wanted.includes(dOf(e)))
    },
    subscribe: () => () => {},
    states: () => [{ url: 'wss://test', status: 'live', newestAt: 1 }],
    close: () => {},
  }),
}))

const { en } = await import('~/i18n/en')
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

describe('the cross, while the scoped documents are still in the air', () => {
  test('trusts the snapshot it was built for', () => {
    expect(PUBLISHER).toHaveLength(64)
  })

  test('stays a skeleton rather than saying nobody published a breakdown', async () => {
    // Arrange / Act — the base figures land; the scoped round is held.
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('.b-kpi strong')).toHaveLength(4)
    })

    // Assert — no verdict on a document that has not answered yet.
    expect(container.querySelector('.b-matrix-skeleton')).not.toBeNull()
    expect(container.querySelector('.b-matrix table')).toBeNull()
    const empties = [...container.querySelectorAll('.b-empty')].map((n) => n.textContent)
    expect(empties).not.toContain(en.matrix.empty)

    // And once they answer, the cross is drawn in full.
    release()
    await waitFor(() => {
      expect(container.querySelectorAll('.b-matrix tbody tr')).toHaveLength(2)
    })
  })
})
