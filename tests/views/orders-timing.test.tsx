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
 * Orders · how long a trade takes once it is taken.
 *
 * bestiario signs the SPEC §6.4 durations in the network's `orders:<w>`
 * documents, and nowhere else: not per instance, not per currency. The tile
 * reads them on the network reading, says how many trades they rest on, and
 * renders an empty sample — or a snapshot from before they were published —
 * as absence and never as a duration of zero.
 */

const KEY = generateSecretKey()

const AR_PUBKEY = 'a'.repeat(64)

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
const seconds = (name: string, value: number) => metric(name, 'seconds', value)

const INSTANCES: WindowPayload = {
  range: RANGE,
  metrics: [
    text('instances.Mostro AR.pubkey', AR_PUBKEY),
    text('instances.Mostro AR.name', 'Mostro AR'),
    count('instances.Mostro AR.created', 15),
  ],
}

const DOCS: Record<string, WindowPayload> = {
  // Twenty trades timed out of the 1 204 completed: the sample covers only
  // trades whose take bestiario saw live.
  'orders:30d': {
    range: RANGE,
    metrics: [
      count('orders.created', 1500),
      count('orders.completed', 1204),
      count('orders.canceled', 101),
      count('orders.in_progress_now', 3),
      count('orders.ARS.created', 15),
      count('orders.ARS.completed', 9),
      count('timing.time_to_complete_samples', 20),
      seconds('timing.time_to_complete_p50', 486),
      seconds('timing.time_to_complete_p90', 1630),
    ],
  },
  'market:30d': { range: RANGE, metrics: [] },
  'instances:30d': INSTANCES,
  // A window in which no trade could be timed.
  'orders:7d': {
    range: RANGE,
    metrics: [
      count('orders.created', 4),
      count('timing.time_to_complete_samples', 0),
      metric('timing.time_to_complete_p50', 'missing', null),
      metric('timing.time_to_complete_p90', 'missing', null),
    ],
  },
  'market:7d': { range: RANGE, metrics: [] },
  'instances:7d': INSTANCES,
  // A snapshot from before bestiario published durations.
  'orders:24h': { range: RANGE, metrics: [count('orders.created', 2)] },
  'market:24h': { range: RANGE, metrics: [] },
  'instances:24h': INSTANCES,
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

const TILE = () => en.ordersView.timeToComplete

describe('Orders · time to complete', () => {
  test('leads the network reading with the typical time, the 9-in-10 time and how many were timed', async () => {
    // Arrange / Act
    const { container } = render(<Orders window="30d" />)

    // Assert
    await waitFor(() => {
      expect(valueOf(container, TILE())).toBe(printed('seconds', 486))
    })
    const sub = tile(container, TILE())?.querySelector('small')?.textContent ?? ''
    expect(sub).toContain(en.ordersView.timeToCompleteNineInTen)
    expect(sub).toContain(printed('seconds', 1630))
    expect(sub).toContain(`${printed('count', 20)} ${en.ordersView.timeToCompleteTimed}`)
  })

  test('says what the figure covers', async () => {
    const { container } = render(<Orders window="30d" />)

    await waitFor(() => {
      expect(valueOf(container, TILE())).toBe(printed('seconds', 486))
    })
    expect(container.textContent).toContain(en.ordersView.timingNote)
  })

  test('renders a window with nothing timed as a sample of zero and no duration', async () => {
    // Arrange / Act
    const { container } = render(<Orders window="7d" />)

    // Assert — a dash that says it was not measured, never "0 s".
    await waitFor(() => {
      expect(valueOf(container, TILE())).toContain('—')
    })
    expect(valueOf(container, TILE())).toContain(en.absence.notMeasured)
    const sub = tile(container, TILE())?.querySelector('small')?.textContent ?? ''
    expect(sub).toContain(`${printed('count', 0)} ${en.ordersView.timeToCompleteTimed}`)
    expect(sub).not.toContain(printed('seconds', 0))
  })

  test('renders a snapshot that predates the durations as not published', async () => {
    const { container } = render(<Orders window="24h" />)

    await waitFor(() => {
      expect(valueOf(container, TILE())).toContain('—')
    })
    expect(valueOf(container, TILE())).toContain(en.absence.notPublished)
  })

  test('never puts the network figure under an instance name', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, TILE())).toBe(printed('seconds', 486))
    })

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — the instance reading keeps its own in-progress tile, and the
    // note says why timing does not narrow.
    expect(tile(container, TILE())).toBeNull()
    expect(tile(container, en.ordersView.inProgressNow)).not.toBeNull()
    expect(container.textContent).not.toContain(printed('seconds', 486))
    expect(container.textContent).toContain(en.ordersView.timingNotNarrowed)
  })

  test('never puts the network figure under a currency', async () => {
    // Arrange
    const { container } = render(<Orders window="30d" />)
    await waitFor(() => {
      expect(valueOf(container, TILE())).toBe(printed('seconds', 486))
    })

    // Act
    await chooseFiat(container, 'ARS')

    // Assert
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.completed)).toBe('9')
    })
    expect(tile(container, TILE())).toBeNull()
    expect(container.textContent).not.toContain(printed('seconds', 486))
    expect(container.textContent).toContain(en.ordersView.timingNotNarrowed)
  })
})
