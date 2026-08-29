import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
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
 * Volume, narrowed to one instance.
 *
 * Per-instance volume *is* published — one row per publisher in
 * `compare:<window>` — and this is what reads it. The join goes by label,
 * because a compare block carries no pubkey; the ticket sizes, the split and
 * the reference conversion are network-wide, and stay absent under an
 * instance's name.
 */

const KEY = generateSecretKey()

const AR_PUBKEY = 'a'.repeat(64)
const VE_PUBKEY = 'b'.repeat(64)

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
const text = (name: string, value: string) => metric(name, 'text', value)

const DOCS: Record<string, WindowPayload> = {
  'volume:30d': {
    range: RANGE,
    metrics: [
      metric('volume.sats', 'sats', 1_000_000),
      count('volume.completed', 40),
      metric('volume.ticket_p50', 'sats', 12_000),
      metric('volume.ticket_p90', 'sats', 30_000),
      metric('volume.largest', 'sats', 90_000),
      metric('volume.ticket_avg', 'sats', 25_000),
      metric('volume.buy_sats', 'sats', 600_000),
      metric('volume.sell_sats', 'sats', 400_000),
      metric('volume.fiat.ARS.total', 'fiat', { amount: 500, code: 'ARS' }),
      count('volume.fiat.ARS.orders', 30),
      metric('volume.fiat.VES.total', 'fiat', { amount: 20, code: 'VES' }),
      count('volume.fiat.VES.orders', 10),
    ],
  },
  'instances:30d': {
    range: RANGE,
    metrics: [
      text('instances.Mostro AR (aaaa).pubkey', AR_PUBKEY),
      text('instances.Mostro AR (aaaa).name', 'Mostro AR'),
      count('instances.Mostro AR (aaaa).created', 30),
      text('instances.Mostro VE (bbbb).pubkey', VE_PUBKEY),
      text('instances.Mostro VE (bbbb).name', 'Mostro VE'),
      count('instances.Mostro VE (bbbb).created', 10),
    ],
  },
  // Keyed by label and carrying no pubkey — the join the view has to make.
  // Only the first instance has a block: the second is the honest absence.
  'compare:30d': {
    range: RANGE,
    metrics: [
      count('compare.Mostro AR (aaaa).completed', 24),
      metric('compare.Mostro AR (aaaa).volume_sats', 'sats', 250_000),
      metric('compare.Mostro AR (aaaa).completion_rate', 'ratio', 0.8),
      metric('compare.Mostro AR (aaaa).fee', 'ratio', 0.01),
      metric('compare.Mostro AR (aaaa).dev_fees_sats', 'sats', 2_500),
    ],
  },
  [`orders:30d:i:${AR_PUBKEY}`]: {
    range: RANGE,
    metrics: [
      count('orders.created', 30),
      count('orders.ARS.created', 28),
      count('orders.ARS.completed', 22),
    ],
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

const { en } = await import('~/i18n/en')
const { formatMetric } = await import('~/model/format')
const { Volume } = await import('~/views/Volume')
const { resetStore } = await import('~/store/useStore')
const { clearCache } = await import('~/store/cache')

beforeAll(async () => {
  events = await buildSnapshot()
})

beforeEach(() => {
  resetStore()
  clearCache()
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

/** Every figure on the page, tile and pair alike. */
const textOf = (root: Element) => root.textContent ?? ''

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

async function openNetwork() {
  const { container } = render(<Volume window="30d" />)
  await waitFor(() => {
    expect(valueOf(container, en.volumeView.total)).toBe(printed('sats', 1_000_000))
  })
  return container
}

describe('Volume · narrowed to one instance', () => {
  test('leads with the network figures while no instance is chosen', async () => {
    // Arrange / Act
    const container = await openNetwork()

    // Assert
    expect(valueOf(container, en.volumeView.completed)).toBe('40')
    expect(valueOf(container, en.volumeView.p50)).toBe(printed('sats', 12_000))
  })

  test('shows the instance own volume from the comparison document', async () => {
    // Arrange
    const container = await openNetwork()

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — its own 250k, never the network's million.
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.total)).toBe(printed('sats', 250_000))
    })
    expect(valueOf(container, en.volumeView.completed)).toBe('24')
    expect(valueOf(container, en.volumeView.devFees)).toBe(printed('sats', 2_500))
  })

  test('works out its share of what the network moved', async () => {
    // Arrange
    const container = await openNetwork()

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — 250k of a million.
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.shareOfNetwork)).toBe(
        printed('ratio', 0.25),
      )
    })
  })

  test('leaves the network-wide figures absent rather than lending them a name', async () => {
    // Arrange
    const container = await openNetwork()

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — no percentile, no largest order, no buy/sell split.
    await waitFor(() => {
      expect(valueOf(container, en.volumeView.total)).toBe(printed('sats', 250_000))
    })
    expect(tile(container, en.volumeView.p50)).toBeNull()
    expect(tile(container, en.volumeView.largest)).toBeNull()
    expect(textOf(container)).not.toContain(printed('sats', 600_000))
    expect(textOf(container)).not.toContain(printed('sats', 400_000))
    expect(textOf(container)).toContain(en.filters.noInstanceVolume)
  })

  test('counts the currencies the instance own document names', async () => {
    // Arrange
    const container = await openNetwork()

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — its 22 completed in ARS, and not the network's 30 orders.
    const rows = () =>
      [...container.querySelectorAll('.b-table .b-pair')].map((row) => row.textContent)
    await waitFor(() => {
      expect(rows()).toEqual(['ARS22'])
    })
    expect(textOf(container)).toContain(en.volumeView.instanceCurrencies)
  })

  test('says so plainly when the comparison document names no block for it', async () => {
    // Arrange
    const container = await openNetwork()

    // Act
    await chooseInstance(container, 'Mostro VE')

    // Assert — absence, and never a zero.
    await waitFor(() => {
      expect(container.querySelector('.b-filter-note')?.textContent).toBe(
        en.filters.noCompareRow('Mostro VE'),
      )
    })
    expect(valueOf(container, en.volumeView.total)).toBe('—')
    expect(valueOf(container, en.volumeView.shareOfNetwork)).toBe('—')
  })
})
