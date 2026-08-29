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
 * What the Orders route does while an instance's own document is answering.
 *
 * A scoped document has four answers, and three of them are not "there is
 * none". It can still be in the air, it can fail verification, and it can
 * arrive with figures on a window where the network's own document is empty.
 * The route may only fall back to the instance's block — its `created` count
 * — for the fourth: an address the index does not name at all.
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

/**
 * The network document is empty on this window — a quiet archive — and the
 * instance's own is not. Its figures must survive that.
 */
const DOCS: Record<string, WindowPayload> = {
  'orders:30d': { range: RANGE, metrics: [count('orders.ARS.completed', 7)] },
  'volume:30d': { range: RANGE, metrics: [] },
  'market:30d': { range: RANGE, metrics: [] },
  'instances:30d': {
    range: RANGE,
    metrics: [
      text('instances.Mostro AR.pubkey', AR_PUBKEY),
      text('instances.Mostro AR.name', 'Mostro AR'),
      count('instances.Mostro AR.created', 3),
    ],
  },
  // A second window, so a reader can carry a currency into one whose
  // documents have not answered yet.
  'orders:all': {
    range: RANGE,
    metrics: [count('orders.created', 40), count('orders.ARS.completed', 11)],
  },
  'volume:all': { range: RANGE, metrics: [] },
  'market:all': { range: RANGE, metrics: [] },
  'instances:all': { range: RANGE, metrics: [] },
  [SCOPED]: {
    range: RANGE,
    metrics: [
      count('orders.created', 12),
      count('orders.completed', 9),
      count('orders.ARS.created', 12),
    ],
  },
}

let events: Event[] = []
/** Held while a test wants the scoped round still in the air. */
let held: Promise<void> | null = null
/** Which addresses a test wants still in the air; the scoped round by default. */
let heldFor: ((d: string) => boolean) | null = null
let release: () => void = () => {}

/**
 * Sign the snapshot. With `tamper`, the scoped document is published with a
 * payload the index's hash does not cover — a document that fails
 * verification in the browser, which is not the same as one that is absent.
 */
async function buildSnapshot(tamper: boolean): Promise<Event[]> {
  const now = Math.floor(Date.now() / 1000)
  const documents: { d: string; hash: string; revision: number; updated_at: string }[] =
    []
  const signed: Event[] = []

  for (const [d, payload] of Object.entries(DOCS)) {
    const hash = await sha256Hex(canonicalPayload(payload))
    documents.push({ d, hash, revision: 1, updated_at: RANGE.until })
    const published =
      tamper && d === SCOPED
        ? { ...payload, metrics: [count('orders.created', 999)] }
        : payload
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
      const holding = heldFor ?? ((d: string) => d.includes(':i:'))
      if (held && wanted?.some((d) => holding(d))) await held
      return events.filter((e) => !wanted || wanted.includes(dOf(e)))
    },
    subscribe: () => () => {},
    states: () => [{ url: 'wss://test', status: 'live', newestAt: 1 }],
    close: () => {},
  }),
}))

const { en } = await import('~/i18n/en')
const { Orders } = await import('~/views/Orders')
const { resetStore } = await import('~/store/useStore')
const { clearCache } = await import('~/store/cache')

beforeEach(() => {
  resetStore()
  clearCache()
  held = null
  heldFor = null
})

afterEach(cleanup)

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

describe('Orders · the instance own document answers', () => {
  test('reads its figures even when the network document is empty', async () => {
    // Arrange — nothing to gate on: `orders:30d` carries no metric at all.
    events = await buildSnapshot(false)
    const { container } = render(<Orders window="30d" />)

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — its own 12 and 9, and not a skeleton over them.
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('12')
    })
    expect(valueOf(container, en.ordersView.completed)).toBe('9')
    expect(skeletons(container)).toHaveLength(0)
  })

  test('says nothing about the instance until its document has answered', async () => {
    // Arrange — the scoped round is held, as a slow relay holds it.
    events = await buildSnapshot(false)
    held = new Promise<void>((resolve) => {
      release = resolve
    })
    const { container } = render(<Orders window="30d" />)

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — placeholders, and no verdict about what it publishes.
    await waitFor(() => {
      expect(skeletons(container).length).toBeGreaterThan(0)
    })
    expect(container.textContent).not.toContain(en.ordersView.perCurrencyNoDocument)
    expect(container.querySelector('.b-filter-note')).toBeNull()

    // Act — the relay answers.
    release()

    // Assert
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('12')
    })
  })

  test('repeats nothing from a document that failed verification', async () => {
    // Arrange — published with a payload the index's hash does not cover.
    events = await buildSnapshot(true)
    const { container } = render(<Orders window="30d" />)

    // Act
    await chooseInstance(container, 'Mostro AR')

    // Assert — the failure is said, and the tampered 999 never appears.
    await waitFor(() => {
      expect(container.querySelector('.b-filter-note')?.textContent).toBe(
        en.filters.unverifiedScoped('Mostro AR', 'hash'),
      )
    })
    expect(container.textContent).not.toContain('999')
    // What is left is the instance's own block, which did verify.
    expect(valueOf(container, en.ordersView.created)).toBe('3')
  })
})

describe('Orders · one instance in one currency', () => {
  test('reads the currency block of the instance own document', async () => {
    // Arrange — its document counts 12 created in ARS, and says nothing
    // about what completed or is open in that currency.
    events = await buildSnapshot(false)
    const { container } = render(<Orders window="30d" />)

    // Act
    await chooseInstance(container, 'Mostro AR')
    await chooseFiat(container, 'ARS')

    // Assert
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.created)).toBe('12')
    })
    expect(valueOf(container, en.ordersView.completed)).toBe('—')
    expect(valueOf(container, en.ordersView.openNow)).toBe('—')
    expect(container.textContent).toContain(en.filters.instanceAndFiatOrders)
  })
})

describe('Orders · a currency whose document has not answered', () => {
  test('waits for the document it reads rather than claiming absence', async () => {
    // Arrange — a currency is read from the window's own orders document,
    // the same one the network figures come from. Pick ARS while `30d`
    // has it.
    events = await buildSnapshot(false)
    const { container, rerender } = render(<Orders window="30d" />)
    await chooseFiat(container, 'ARS')
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.completed)).toBe('7')
    })

    // Act — change the window with the currency still chosen, and hold the
    // round that carries the new window's documents.
    held = new Promise<void>((resolve) => {
      release = resolve
    })
    heldFor = (d) => d.startsWith('orders:') && !d.includes(':i:')
    rerender(<Orders window="all" />)

    // Assert — placeholders, and never a dash claiming ARS has nothing.
    await waitFor(() => {
      expect(skeletons(container).length).toBeGreaterThan(0)
    })
    expect(tile(container, en.ordersView.completed)).toBeNull()

    // Act — the relay answers.
    release()

    // Assert
    await waitFor(() => {
      expect(valueOf(container, en.ordersView.completed)).toBe('11')
    })
  })
})
