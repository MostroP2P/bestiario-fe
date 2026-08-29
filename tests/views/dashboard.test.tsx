import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact'
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
const { en } = await import('~/i18n/en')
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

    expect(getByRole('status').textContent).toBe(
      en.loading.announcement(en.loading.figures),
    )
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

  test('heads the panel with the currency × instance cross', async () => {
    // Arrange / Act
    const { container } = render(<Dashboard />)

    // Assert — the cross is the first block of the panel, as artboard 2a
    // has it, and it is filled from the scoped orders documents.
    await waitFor(() => {
      const heads = [...container.querySelectorAll('.b-section-head')].map(
        (n) => n.textContent,
      )
      expect(heads[0]).toBe(en.matrix.heading)
    })
  })

  test('says no instance published a breakdown rather than drawing zeros', async () => {
    // This archive carries no `orders:<window>:i:<pubkey>` document. A grid
    // of zeros would say every instance traded nothing, which is a claim
    // nobody published; the absence is stated instead.
    const scoped = fixtures.filter((event) => dOf(event).includes(':i:'))
    expect(scoped).toEqual([])

    // Act
    const { container } = render(<Dashboard />)

    // Assert
    await waitFor(() => {
      const empties = [...container.querySelectorAll('.b-empty')].map(
        (n) => n.textContent,
      )
      expect(empties).toContain(en.matrix.empty)
    })
    expect(container.querySelector('.b-matrix')).toBeNull()
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
      expect(note).toMatch(/illustrative/)
      // Names the document whose absence is the reason.
      expect(note).toMatch(/orders:…:i:<pubkey>/)
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
    // Read out of the index rather than named here: the archive moves.
    const index = JSON.parse(fixtures.find((e) => dOf(e) === 'index')!.content) as {
      coverage: { first_event_at: string; last_event_at: string }
    }
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.textContent).toContain(index.coverage.first_event_at.slice(0, 10))
    })
    expect(container.textContent).toContain(index.coverage.last_event_at.slice(0, 10))
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
      expect(getByRole('alert').textContent).toContain(en.fatal.heading)
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

describe('Dashboard · a window figure is not a now figure', () => {
  const metricsOfWindow = (report: string, window: string) => {
    const event = fixtures.find((e) => dOf(e) === `${report}:${window}`)!
    return (
      JSON.parse(event.content) as {
        payload: { metrics: { name: string; value: number }[] }
      }
    ).payload.metrics
  }
  const figure = (report: string, window: string, name: string) =>
    metricsOfWindow(report, window).find((m) => m.name === name)!.value
  const asCount = (value: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)

  const disputesKpi = (container: Element) =>
    [...container.querySelectorAll('.b-kpi')].find((kpi) =>
      kpi.querySelector('.b-eyebrow')?.textContent?.startsWith('DISPUTES'),
    )

  test('the disputes tile counts the window, not the standing book', async () => {
    // Arrange — `open_now` is the same in every window; `opened` is not.
    const opened = figure('disputes', '30d', 'disputes.opened')
    const openNow = figure('disputes', '30d', 'disputes.open_now')
    expect(opened).not.toBe(openNow)

    // Act
    const { container } = render(<Dashboard />)

    // Assert
    await waitFor(() => {
      expect(disputesKpi(container)?.querySelector('strong')?.textContent).toBe(
        asCount(opened),
      )
    })
    expect(disputesKpi(container)?.querySelector('strong')?.textContent).not.toBe(
      asCount(openNow),
    )
  })

  test('and moves when the window does, which a now figure would not', async () => {
    // Arrange
    const { container, getByLabelText } = render(<Dashboard />)
    await waitFor(() => {
      expect(disputesKpi(container)?.querySelector('strong')).not.toBeNull()
    })
    const before = disputesKpi(container)?.querySelector('strong')?.textContent

    // Act — the window is a select now that the header carries the sections.
    fireEvent.change(getByLabelText(en.header.windowNav), { target: { value: '24h' } })

    // Assert
    await waitFor(() => {
      expect(disputesKpi(container)?.querySelector('strong')?.textContent).toBe(
        asCount(figure('disputes', '24h', 'disputes.opened')),
      )
    })
    expect(disputesKpi(container)?.querySelector('strong')?.textContent).not.toBe(before)
  })

  test('the standing book is counted where it says it is about now', async () => {
    const openNow = figure('disputes', '30d', 'disputes.open_now')
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('.b-dispute-list li')).toHaveLength(openNow)
    })
    const heading = [...container.querySelectorAll('.b-feed-head')].find((h) =>
      h.textContent?.includes('DISPUTES'),
    )
    expect(heading?.textContent).toContain('NOW')
  })

  test('no tile in the window row repeats the standing book', async () => {
    // The bug this replaced: one heading answering two questions, and the
    // same 41 in the tile and in the panel beside it.
    const openNow = figure('disputes', '30d', 'disputes.open_now')
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(container.querySelectorAll('.b-kpi strong')).toHaveLength(4)
    })
    const tiles = [...container.querySelectorAll('.b-kpi strong')].map(
      (n) => n.textContent,
    )
    expect(tiles).not.toContain(asCount(openNow))
  })
})
