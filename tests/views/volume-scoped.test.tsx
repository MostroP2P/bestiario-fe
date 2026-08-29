import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact'
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
 * What the Volume route does while the comparison document is answering.
 *
 * `compare:<window>` is asked for a round trip after the reader picks an
 * instance, so there is a stretch where the tiles have nothing yet. Drawing
 * absence through it would say the publisher signs no volume for this
 * instance, and a document that failed verification would say the same. Both
 * are verdicts nobody has given: the first is a document still in the air,
 * the second is one this page must not repeat.
 */

const KEY = generateSecretKey()

const AR_PUBKEY = 'a'.repeat(64)

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

const SCOPED = `orders:30d:i:${AR_PUBKEY}`
const COMPARE = 'compare:30d'

const sats = (name: string, value: number): Metric => ({
  name,
  kind: 'observed',
  unit: 'sats',
  value,
})

const ORDERS = 'orders:30d'

const DOCS: Record<string, WindowPayload> = {
  'volume:30d': {
    range: RANGE,
    metrics: [
      sats('volume.sats', 1_000_000),
      {
        name: 'volume.fiat.ARS.total',
        kind: 'observed',
        unit: 'fiat',
        value: { amount: 500, code: 'ARS' },
      },
      count('volume.fiat.ARS.orders', 30),
    ],
  },
  'instances:30d': {
    range: RANGE,
    metrics: [
      text('instances.Mostro AR.pubkey', AR_PUBKEY),
      text('instances.Mostro AR.name', 'Mostro AR'),
      count('instances.Mostro AR.created', 30),
    ],
  },
  [COMPARE]: {
    range: RANGE,
    metrics: [
      count('compare.Mostro AR.completed', 24),
      sats('compare.Mostro AR.volume_sats', 250_000),
    ],
  },
  [SCOPED]: {
    range: RANGE,
    metrics: [count('orders.created', 30), count('orders.ARS.completed', 22)],
  },
  // The denominator of the market share: what the whole network completed
  // in the same currency and the same window.
  [ORDERS]: { range: RANGE, metrics: [count('orders.ARS.completed', 88)] },
}

/** What a tampered document carries instead: a figure nobody signed. */
const TAMPERED: Record<string, readonly Metric[]> = {
  [COMPARE]: [sats('compare.Mostro AR.volume_sats', 999)],
  [ORDERS]: [count('orders.ARS.completed', 999)],
}

let events: Event[] = []
/** Held while a test wants the scoped round still in the air. */
let held: Promise<void> | null = null
let release: () => void = () => {}

/**
 * Sign the snapshot. The document `tampered` names is published with a
 * payload the index's hash does not cover — a document that fails
 * verification in the browser, which is not the same as one that is absent.
 */
async function buildSnapshot(tampered: string | null): Promise<Event[]> {
  const now = Math.floor(Date.now() / 1000)
  const documents: { d: string; hash: string; revision: number; updated_at: string }[] =
    []
  const signed: Event[] = []

  for (const [d, payload] of Object.entries(DOCS)) {
    const hash = await sha256Hex(canonicalPayload(payload))
    documents.push({ d, hash, revision: 1, updated_at: RANGE.until })
    const published = d === tampered ? { ...payload, metrics: TAMPERED[d] } : payload
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
            payload: published,
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
      if (held && wanted?.some((d) => d.includes(':i:') || d.startsWith('compare:')))
        await held
      return events.filter((e) => !wanted || wanted.includes(dOf(e)))
    },
    subscribe: () => () => {},
    states: () => [{ url: 'wss://test', status: 'live', newestAt: 1 }],
    close: () => {},
  }),
}))

const { en } = await import('~/i18n/en')
const { formatMetric } = await import('~/model/format')
const { Volume } = await import('~/views/Volume')
const { resetStore } = await import('~/store/useStore')
const { clearCache } = await import('~/store/cache')

beforeEach(() => {
  resetStore()
  clearCache()
  held = null
})

afterEach(cleanup)

/** As the page prints a figure, in whatever locale the run has. */
const printed = (unit: Metric['unit'], value: Metric['value']) =>
  formatMetric({ name: 'x', kind: 'observed', unit, value }).text

/** The tile a label names, read as the reader reads it. */
function tile(root: Element, label: string): HTMLElement | null {
  for (const kpi of root.querySelectorAll('.b-kpi')) {
    if (kpi.querySelector('.b-eyebrow')?.textContent === label) return kpi as HTMLElement
  }
  return null
}

const valueOf = (root: Element, label: string) =>
  tile(root, label)?.querySelector('strong')?.textContent

/** The tiles are placeholders, not figures. */
const skeletons = (root: Element) => root.querySelectorAll('.b-kpi[aria-hidden="true"]')

/** Pick the instance, once the document that names it has arrived. */
async function chooseInstance(container: Element, name: string) {
  const selectFor = () =>
    [...container.querySelectorAll('select')].find((element) =>
      [...element.options].some((option) => option.textContent === name),
    )
  await waitFor(() => {
    expect(selectFor()).toBeDefined()
  })
  const select = selectFor()!
  const option = [...select.options].find((o) => o.textContent === name)!
  fireEvent.change(select, { target: { value: option.value } })
}

/** Pick a currency, once the volume document has named it. */
async function chooseFiat(container: Element, code: string) {
  const selectFor = () =>
    [...container.querySelectorAll('select')].find((element) =>
      [...element.options].some((option) => option.textContent === code),
    )
  await waitFor(() => {
    expect(selectFor()).toBeDefined()
  })
  fireEvent.change(selectFor()!, { target: { value: code } })
}

describe('Volume · the comparison document answers', () => {
  test('says nothing about the instance until the document has answered', async () => {
    // Arrange — the round that carries per-instance volume is held.
    events = await buildSnapshot(null)
    held = new Promise<void>((resolve) => {
      release = resolve
    })
    const { container } = render(<Volume window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.total)).toBe(printed('sats', 1_000_000))
    })

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — placeholders, and no verdict about what it publishes.
    await waitFor(() => {
      expect(skeletons(container).length).toBeGreaterThan(0)
    })
    expect(container.textContent).not.toContain(en.filters.noCompareRow('Mostro AR'))

    // Act — the relay answers.
    release()

    // Assert
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.total)).toBe(printed('sats', 250_000))
    })
  })

  test('repeats nothing from a comparison document that failed verification', async () => {
    // Arrange — published with a payload the index's hash does not cover.
    events = await buildSnapshot(COMPARE)
    const { container } = render(<Volume window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.total)).toBe(printed('sats', 1_000_000))
    })

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — the failure is said, and never mistaken for a missing block.
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.total)).toBe('—')
    })
    expect(container.querySelector('.b-filter-note')?.textContent).toBe(
      en.filters.unverifiedCompare('hash'),
    )
    expect(container.textContent).not.toContain(printed('sats', 999))
  })
})

describe("Volume · the market share's denominator", () => {
  test("says the network's orders document failed, rather than calling the share unpublished", async () => {
    // Arrange — the whole network's count for the window is published with
    // a payload the index's hash does not cover.
    events = await buildSnapshot(ORDERS)
    const { container } = render(<Volume window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.total)).toBe(printed('sats', 1_000_000))
    })

    // Act — one instance, in one currency: the reading the share is part of.
    await chooseInstance(container, 'Mostro AR')
    await chooseFiat(container, 'ARS')

    // Assert — the failure is said, with its reason, and the denominator it
    // carried is never read.
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.completed)).toBe('22')
    })
    expect(container.querySelector('.b-filter-note')?.textContent).toBe(
      en.filters.unverifiedOrders('hash'),
    )
    expect(valueOf(container, en.volumeView.shareOfMarket)).toContain('—')
    expect(container.textContent).not.toContain(printed('ratio', 22 / 999))
  })
})
