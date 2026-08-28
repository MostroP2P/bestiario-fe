import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/preact'
import { readFileSync } from 'node:fs'
import { Dashboard } from '~/views/Dashboard'
import { clearAtlasCache } from '~/map/useAtlas'
import type { LiveOrder } from '~/model/live-lines'

const TOPOLOGY = JSON.parse(readFileSync('public/geo/countries-110m.json', 'utf8')) as unknown

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
  clearAtlasCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(TOPOLOGY) })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function order(over: Partial<LiveOrder> = {}): LiveOrder {
  return {
    id: 'o1',
    fiat: 'ARS',
    status: 'pending',
    instancePubkey: 'k3',
    updatedAt: Date.now(),
    ...over,
  }
}

describe('Dashboard', () => {
  test('says plainly when the figures around the map are only samples', () => {
    const { getByRole } = render(<Dashboard sample />)

    expect(getByRole('status').textContent).toMatch(/DATOS DE EJEMPLO/)
  })

  test('makes no such claim when it is not showing samples', () => {
    const { queryByRole } = render(<Dashboard />)

    expect(queryByRole('status')).toBeNull()
  })

  test('draws the section navigation with the overview current', () => {
    const { getByRole } = render(<Dashboard />)

    const nav = getByRole('navigation', { name: 'Secciones' })
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('RESUMEN')
  })

  test('draws a line on the map for each order it is given', async () => {
    // Arrange — three orders on one route, one on another.
    const orders = [
      order({ id: 'a' }),
      order({ id: 'b' }),
      order({ id: 'c' }),
      order({ id: 'd', fiat: 'VES', instancePubkey: 'k4' }),
    ]

    // Act
    const { container } = render(<Dashboard orders={orders} />)

    // Assert — the atlas has to arrive before anything is drawn.
    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(4)
    })
  })

  test('counts the markets and the mostros those lines touch', async () => {
    const orders = [order({ id: 'a' }), order({ id: 'b', fiat: 'VES', instancePubkey: 'k4' })]

    const { container } = render(<Dashboard orders={orders} />)

    await waitFor(() => {
      expect(container.querySelector('.b-map-count strong')?.textContent).toBe('2')
    })
    expect(container.querySelector('.b-map-count small')?.textContent).toBe('en 2 mostros')
  })

  test('shows the same counts in the grid as it draws on the map', async () => {
    const orders = [order({ id: 'a' }), order({ id: 'b' }), order({ id: 'c' })]

    const { container } = render(<Dashboard orders={orders} />)

    await waitFor(() => {
      const cells = [...container.querySelectorAll('.b-cell')].map((c) => c.textContent)
      // satoshi.br x ARS is the only pair with lines on it, and it has three.
      expect(cells.filter((t) => t === '3')).toHaveLength(1)
    })
  })

  test('draws no lines when no orders are active', async () => {
    const { container } = render(<Dashboard orders={[]} />)

    await waitFor(() => {
      expect(container.querySelector('svg[role="img"]')).not.toBeNull()
    })
    expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(0)
    expect(container.querySelector('.b-map-count strong')?.textContent).toBe('0')
  })

  test('drops a settled order once its grace period has passed', async () => {
    const stale = order({ id: 'old', status: 'success', updatedAt: Date.now() - 60 * 60 * 1000 })

    const { container } = render(<Dashboard orders={[stale, order({ id: 'live' })]} />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(1)
    })
  })

  test('counts only what the map actually draws', async () => {
    // Arrange - k1 is mostro.network, whose name places it nowhere, so its
    // orders cannot be drawn and must not be counted either.
    const orders = [
      order({ id: 'drawn', instancePubkey: 'k3' }),
      order({ id: 'undrawable', fiat: 'COP', instancePubkey: 'k1' }),
    ]

    // Act
    const { container } = render(<Dashboard orders={orders} />)

    // Assert
    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(1)
    })
    expect(container.querySelector('.b-map-count strong')?.textContent).toBe('1')
    expect(container.querySelector('.b-map-count small')?.textContent).toBe('en 1 mostros')
  })

  test('says how many places it could not draw rather than hiding them', async () => {
    const orders = [
      order({ id: 'drawn', instancePubkey: 'k3' }),
      order({ id: 'undrawable', instancePubkey: 'k1' }),
    ]

    const { container } = render(<Dashboard orders={orders} />)

    await waitFor(() => {
      expect(container.querySelector('.b-unplaced')?.textContent).toMatch(
        /1 sin ubicar, fuera del mapa/,
      )
    })
  })

  test('says nothing about unplaced places when everything is drawn', async () => {
    const { container } = render(<Dashboard orders={[order({ instancePubkey: 'k3' })]} />)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(1)
    })
    expect(container.querySelector('.b-unplaced')).toBeNull()
  })

  test('states the grace period on screen rather than hiding it in a constant', () => {
    const { container } = render(<Dashboard />)

    expect(container.querySelector('.b-map-caption p')?.textContent).toMatch(
      /10 minutos después de completarse/,
    )
  })
})

describe('Dashboard · geometry that will not load', () => {
  test('says so instead of rendering an empty panel', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 503, statusText: 'Unavailable' })),
    )

    // Act
    const { container } = render(<Dashboard />)

    // Assert
    await waitFor(() => {
      const state = container.querySelector('.b-map-state[data-failed="true"]')
      expect(state?.textContent).toMatch(/SIN GEOMETRÍA · 503 Unavailable/)
    })
  })
})
