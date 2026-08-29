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
 * Orders, narrowed to one instance.
 *
 * The archive publishes no `orders:<w>:i:<pubkey>` yet (SPEC 14.3), so the
 * only order figure signed for an instance is the `created` count in its own
 * block. Everything else has to read as absence: the network's totals under
 * an instance's name would be a claim nobody signed.
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
  'orders:30d': {
    range: RANGE,
    metrics: [
      count('orders.created', 20),
      count('orders.completed', 12),
      count('orders.canceled', 4),
      count('orders.in_progress_now', 3),
    ],
  },
  'volume:30d': {
    range: RANGE,
    metrics: [count('volume.fiat.ARS.orders', 9), count('volume.fiat.VES.orders', 3)],
  },
  // A window the archive reaches further back than ARS's first order.
  'orders:all': { range: RANGE, metrics: [count('orders.created', 50)] },
  'volume:all': { range: RANGE, metrics: [count('volume.fiat.VES.orders', 8)] },
  'market:all': { range: RANGE, metrics: [] },
  'instances:all': { range: RANGE, metrics: [] },
  'market:30d': {
    range: RANGE,
    metrics: [
      metric('market.buy_orders_share', 'ratio', 0.6),
      metric('market.sell_orders_share', 'ratio', 0.4),
    ],
  },
  'instances:30d': {
    range: RANGE,
    metrics: [
      text('instances.Mostro AR.pubkey', AR_PUBKEY),
      text('instances.Mostro AR.name', 'Mostro AR'),
      count('instances.Mostro AR.created', 15),
      metric('instances.Mostro AR.min_order', 'sats', 500),
      metric('instances.Mostro AR.max_order', 'sats', 500000),
      text('instances.Mostro VE.pubkey', VE_PUBKEY),
      text('instances.Mostro VE.name', 'Mostro VE'),
      count('instances.Mostro VE.created', 5),
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
const { Orders } = await import('~/views/Orders')
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

async function chooseInstance(container: Element, name: string) {
  // The instances document lands a round trip after the base ones, so the
  // option the reader picks is waited for rather than assumed.
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
  await waitFor(() => {
    expect(container.textContent).toContain(en.ordersView.instanceHeading)
  })
}

describe('Orders · narrowed to one instance', () => {
  test('leads with the network totals while no instance is chosen', async () => {
    // Arrange / Act
    const { container } = render(<Orders window="30d" />)

    // Assert
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('20')
    })
    expect(valueOf(container, en.ordersView.completed)).toBe('12')
  })

  test('shows the instance own created count and not the network total', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('20')
    })

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert
    expect(valueOf(container, en.ordersView.created)).toBe('15')
  })

  test('leaves a figure the publisher does not sign per instance absent', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('20')
    })

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — never the network's 12, 4 and 3.
    expect(valueOf(container, en.ordersView.completed)).toBe('—')
    expect(valueOf(container, en.ordersView.canceled)).toBe('—')
    expect(valueOf(container, en.ordersView.inProgressNow)).toBe('—')
  })

  test('stops showing the network breakdown by currency', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(container.textContent).toContain('ARS')
    })

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert
    expect(container.textContent).toContain(en.ordersView.perCurrencyNoDocument)
    expect(container.querySelector('.b-table')?.textContent).toBe('')
  })

  test('says the buy and sell split is the network its own', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('20')
    })

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert
    expect(container.textContent).toContain(en.ordersView.shareNotPerInstance)
    expect(container.textContent).not.toContain('60')
  })

  test('shows the minimum order beside the maximum', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('20')
    })

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert
    const pairs = [...container.querySelectorAll('.b-pair')].map((p) => p.textContent)
    expect(pairs.some((row) => row?.startsWith(en.ordersView.instanceMinOrder))).toBe(
      true,
    )
    expect(pairs.some((row) => row?.startsWith(en.ordersView.instanceMaxOrder))).toBe(
      true,
    )
  })
})

describe('Orders · narrowed to one currency', () => {
  test('counts what completed in that currency, and its share of the whole', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('20')
    })

    // Act
    await chooseFiat(container, 'ARS')

    // Assert — 9 of the 12 the network completed.
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.completed)).toBe('9')
    })
    expect(valueOf(container, en.ordersView.shareOfCompleted)).toBe(
      printed('ratio', 0.75),
    )
  })

  test('offers no per-currency reading of what nothing signs per currency', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('20')
    })

    // Act
    await chooseFiat(container, 'ARS')

    // Assert — created, canceled and in-progress are not the currency's,
    // and the network's are not shown under it either.
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.completed)).toBe('9')
    })
    expect(tile(container, en.ordersView.created)).toBeNull()
    expect(tile(container, en.ordersView.canceled)).toBeNull()
    expect(container.textContent).toContain(en.filters.noFiatOrders)
    expect(container.textContent).not.toContain(printed('ratio', 0.6))
  })
})

describe('Orders · a currency this window does not have', () => {
  test('holds the currency reading and leaves it absent, not the network', async () => {
    // Arrange — ARS is counted on `30d`, and the reader picks it there.
    const { container, rerender } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('20')
    })
    await chooseFiat(container, 'ARS')
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.completed)).toBe('9')
    })

    // Act — the window changes under the selection.
    rerender(<Orders window="all" />)

    // Assert — absence under ARS, and never the 50 the network created.
    await waitFor(() => {
      expect(container.textContent).toContain(en.filters.fiatUnavailable('ARS'))
    })
    expect(valueOf(container, en.ordersView.completed)).toBe('—')
    expect(container.textContent).not.toContain('50')
  })
})
