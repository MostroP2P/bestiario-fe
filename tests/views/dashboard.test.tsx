import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/preact'
import { readFileSync, readdirSync } from 'node:fs'
import type { Event, Filter } from 'nostr-tools'

const DIR = 'tests/fixtures/snapshot'
const fixtures: Event[] = readdirSync(DIR)
  .filter((file) => file !== 'manifest.json')
  .map((file) => JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as Event)
const dOf = (event: Event) => event.tags.find((tag) => tag[0] === 'd')?.[1] ?? ''

/** What the fake pool will serve. Swapped per test before rendering. */
let served: Event[] = fixtures

vi.mock('~/nostr/pool', () => ({
  openRelays: () => ({
    query: (filter: Filter) => {
      const wanted = filter['#d']
      return Promise.resolve(served.filter((e) => !wanted || wanted.includes(dOf(e))))
    },
    subscribe: () => () => {},
    states: () => [{ url: 'wss://relay.mostro.network', status: 'live', newestAt: 1 }],
    close: () => {},
  }),
}))

const { Dashboard } = await import('~/views/Dashboard')
const { resetStore } = await import('~/store/useStore')
const { clearCache } = await import('~/store/cache')
const topology = JSON.parse(
  readFileSync('public/geo/countries-110m.json', 'utf8'),
) as unknown
const { clearAtlasCache } = await import('~/map/useAtlas')

beforeAll(() => {
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
  served = fixtures
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

describe('Dashboard · before the figures arrive', () => {
  test('renders the shell with skeletons rather than a spinner', () => {
    const { container } = render(<Dashboard />)

    expect(container.querySelectorAll('.b-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('.b-skeleton-map')).not.toBeNull()
  })

  test('says once what is loading, and hides the decorative boxes', () => {
    const { getByRole, container } = render(<Dashboard />)

    expect(getByRole('status').textContent).toMatch(/Cargando las cifras de la red/)
    for (const skeleton of container.querySelectorAll('.b-kpi[aria-hidden]')) {
      expect(skeleton.getAttribute('aria-hidden')).toBe('true')
    }
  })

  test('shows no figure it has not verified', () => {
    const { container } = render(<Dashboard />)

    expect(container.querySelector('.b-kpi strong')).toBeNull()
  })
})

describe('Dashboard · real figures', () => {
  test('shows the orders the publisher signed for the window', async () => {
    // Arrange / Act
    const { container } = render(<Dashboard />)

    // Assert — orders:30d, from the live archive, verified against its hash.
    await waitFor(() => {
      const values = [...container.querySelectorAll('.b-kpi strong')].map(
        (n) => n.textContent,
      )
      expect(values.length).toBe(4)
      expect(values[0]).toMatch(/\d/)
    })
  })

  test('lists every currency the network traded, from volume.fiat', async () => {
    // Arrange — read the expected set out of the very document the view
    // renders, so this asserts the grouping and not a snapshot of the market.
    const event = fixtures.find((e) => dOf(e) === 'volume:30d')!
    const payload = (
      JSON.parse(event.content) as { payload: { metrics: { name: string }[] } }
    ).payload
    const expected = [
      ...new Set(
        payload.metrics
          .map((m) => /^volume\.fiat\.([A-Z]{3})\./.exec(m.name)?.[1])
          .filter((code): code is string => code !== undefined),
      ),
    ].sort()

    // Act
    const { container } = render(<Dashboard />)

    // Assert
    await waitFor(() => {
      const codes = [...container.querySelectorAll('.b-table tbody th')].map(
        (n) => n.textContent,
      )
      expect(codes).toEqual(expected)
    })
    expect(expected.length).toBeGreaterThan(5)
  })

  test('draws a market on the map for each currency it can place', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      const nodes = container.querySelectorAll('[data-layer="currencies"] > g')
      expect(nodes.length).toBeGreaterThan(0)
    })
  })

  test('rebuilds the open dispute book from the indexed family', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('.b-dispute-list li').length).toBeGreaterThan(10)
    })
  })

  test('draws movement out of every market that traded', async () => {
    // How many routes a market gets is measured: its share of the busiest.
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(
        container.querySelectorAll('[data-layer="arcs"] path').length,
      ).toBeGreaterThan(10)
    })
  })

  test('gives a traveller to every route, so the movement is visible', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      const arcs = container.querySelectorAll('[data-layer="arcs"] path').length
      expect(container.querySelectorAll('[data-layer="travellers"] circle')).toHaveLength(
        arcs,
      )
    })
  })

  test('says the routes are illustrative rather than letting them be read as fact', async () => {
    // Nothing published names an instance, so nothing on this map may claim
    // one. The note is what keeps the drawing honest.
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      const note = container.querySelector('.b-map-gap')?.textContent ?? ''
      expect(note).toMatch(/ilustrativas/)
      expect(note).toMatch(/instances/)
    })
  })

  test('labels no anchor, because none of them is a place anything named', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(
        container.querySelectorAll('[data-layer="arcs"] path').length,
      ).toBeGreaterThan(0)
    })
    // Every label on the map is a currency code; none is an instance.
    const labels = [...container.querySelectorAll('svg text')].map(
      (t) => t.textContent ?? '',
    )
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) expect(label).toMatch(/^[A-Z]{3}$/)
  })

  test('reports the archive extent the index states', async () => {
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.textContent).toContain('2026-08-27')
    })
  })
})

describe('Dashboard · when nothing can be verified', () => {
  test('shows the failure and no figure at all', async () => {
    // Arrange — every relay silent.
    served = []

    // Act
    const { getByRole, container } = render(<Dashboard />)

    // Assert
    await waitFor(() => {
      expect(getByRole('alert').textContent).toMatch(/Sin cifras verificadas/)
    })
    expect(container.querySelector('.b-kpi strong')).toBeNull()
  })

  test('says which relays it asked, even having failed', async () => {
    served = []

    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.textContent).toContain('relay.mostro.network')
    })
  })
})
