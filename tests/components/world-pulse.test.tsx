import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/preact'
import { WorldPulse, describeScene } from '~/components/WorldPulse'
import type { Line } from '~/model/live-lines'
import type { LonLat } from '~/model/random-point'
import type { Scene } from '~/map/scene'

const PLACES: Record<string, LonLat> = {
  ARS: [-64, -34],
  VES: [-66, 8],
  'node-ar': [-58, -34],
}

const props = {
  land: [],
  currencyAt: (code: string) => PLACES[code] ?? null,
  instanceAt: (pubkey: string) => PLACES[pubkey] ?? null,
  instanceLabel: (pubkey: string) => pubkey,
}

function line(over: Partial<Line> = {}): Line {
  return {
    orderId: 'o1',
    fiat: 'ARS',
    instancePubkey: 'node-ar',
    phase: 'live',
    updatedAt: 0,
    ...over,
  }
}

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

/** jsdom has neither, and the component measures itself with one. */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    private cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe() {
      this.cb(
        [{ contentRect: { width: 900, height: 408 } } as ResizeObserverEntry],
        this,
      )
    }
    unobserve() {}
    disconnect() {}
  }
})

// Unmounting is what cancels the animation frame loop; without it the run
// never ends.
afterEach(cleanup)

describe('WorldPulse', () => {
  beforeAll(() => stubMatchMedia(false))

  test('draws one line per active order', () => {
    // Arrange
    const lines = Array.from({ length: 5 }, (_, i) => line({ orderId: `ars-${i}` }))

    // Act
    const { container } = render(<WorldPulse {...props} lines={lines} />)

    // Assert
    expect(container.querySelectorAll('path[stroke-opacity]')).toHaveLength(5)
  })

  test('gives each of those lines a shape of its own', () => {
    const lines = Array.from({ length: 5 }, (_, i) => line({ orderId: `ars-${i}` }))

    const { container } = render(<WorldPulse {...props} lines={lines} />)

    const shapes = new Set(
      [...container.querySelectorAll('path[stroke-opacity]')].map((p) => p.getAttribute('d')),
    )
    expect(shapes.size).toBe(5)
  })

  test('marks a settling line by more than its colour', () => {
    const { container } = render(
      <WorldPulse {...props} lines={[line(), line({ orderId: 'o2', phase: 'settling' })]} />,
    )

    const dashed = [...container.querySelectorAll('path[stroke-opacity]')].filter((p) =>
      p.getAttribute('stroke-dasharray'),
    )
    expect(dashed).toHaveLength(1)
  })

  test('describes itself for a reader who cannot see it', () => {
    const { container } = render(<WorldPulse {...props} lines={[line()]} />)

    expect(container.querySelector('svg')?.getAttribute('aria-label')).toMatch(
      /1 order flows between 1 currencies and 1 Mostro instances/,
    )
  })

  test('draws no line for an order it cannot place', () => {
    const { container } = render(<WorldPulse {...props} lines={[line({ fiat: 'XXX' })]} />)

    expect(container.querySelectorAll('path[stroke-opacity]')).toHaveLength(0)
  })

  test('renders with no orders at all', () => {
    const { container } = render(<WorldPulse {...props} lines={[]} />)

    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'No order flow to show.',
    )
  })

  test('sizes a currency by how many lines rest on it', () => {
    const one = render(<WorldPulse {...props} lines={[line()]} />)
    const oneRadius = one.container.querySelector('circle[stroke-opacity]')?.getAttribute('r')
    cleanup()

    const many = render(
      <WorldPulse
        {...props}
        lines={Array.from({ length: 9 }, (_, i) => line({ orderId: `o${i}` }))}
      />,
    )
    const manyRadius = many.container.querySelector('circle[stroke-opacity]')?.getAttribute('r')

    expect(Number(manyRadius)).toBeGreaterThan(Number(oneRadius))
  })
})

describe('WorldPulse · reduced motion', () => {
  beforeAll(() => stubMatchMedia(true))

  test('draws no travelling dots when motion is not wanted', () => {
    const { container } = render(<WorldPulse {...props} lines={[line()]} />)

    expect(container.querySelectorAll('circle[r="1.9"]')).toHaveLength(0)
  })
})

describe('describeScene', () => {
  const empty: Scene = {
    arcs: [],
    currencies: [],
    instances: [],
    unplaced: { currencies: 0, instances: 0 },
  }

  test('says so when there is nothing to show', () => {
    expect(describeScene(empty)).toBe('No order flow to show.')
  })

  test('says what it could not place rather than quietly omitting it', () => {
    const scene: Scene = {
      ...empty,
      arcs: [{ orderId: 'a', fiat: 'ARS', instancePubkey: 'n', phase: 'live', points: [[0, 0]] }],
      unplaced: { currencies: 2, instances: 1 },
    }

    expect(describeScene(scene)).toMatch(/2 currencies could not be placed/)
    expect(describeScene(scene)).toMatch(/1 instances could not be placed/)
  })
})
