import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/preact'
import { WorldPulse, describeScene } from '~/components/WorldPulse'
import { buildScene, type Scene } from '~/map/scene'
import { createProjection } from '~/map/projection'
import type { Line } from '~/model/live-lines'
import type { LonLat } from '~/model/random-point'
import type { MapProjection } from '~/map/projection'
import { en } from '~/i18n/en'

const PLACES: Record<string, LonLat> = {
  ARS: [-64, -34],
  VES: [-66, 8],
  'node-ar': [-58, -34],
  'node-ve': [-67, 10],
}

const projection: MapProjection = createProjection(900, 408)

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

function sceneOf(lines: readonly Line[]): Scene {
  return buildScene({
    lines,
    currencyAt: (code) => PLACES[code] ?? null,
    instanceAt: (pubkey) => PLACES[pubkey] ?? null,
    instanceLabel: (pubkey) => pubkey,
    project: projection.project,
  })
}

function draw(lines: readonly Line[], reducedMotion = false) {
  return render(
    <WorldPulse
      scene={sceneOf(lines)}
      land={[]}
      projection={projection}
      width={900}
      height={408}
      reducedMotion={reducedMotion}
      strings={en}
    />,
  )
}

// Unmounting is what cancels the animation frame loop.
afterEach(cleanup)

describe('WorldPulse', () => {
  test('draws every arc the scene carries', () => {
    // Arrange
    const lines = Array.from({ length: 5 }, (_, i) => line({ orderId: `ars-${i}` }))

    // Act
    const { container } = draw(lines)

    // Assert
    expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(5)
  })

  test('gives each of those arcs a shape of its own', () => {
    const lines = Array.from({ length: 5 }, (_, i) => line({ orderId: `ars-${i}` }))

    const { container } = draw(lines)

    const shapes = new Set(
      [...container.querySelectorAll('[data-layer="arcs"] path')].map((p) =>
        p.getAttribute('d'),
      ),
    )
    expect(shapes.size).toBe(5)
  })

  test('marks a settling line by more than its colour', () => {
    const { container } = draw([line(), line({ orderId: 'o2', phase: 'settling' })])

    const dashed = [...container.querySelectorAll('[data-layer="arcs"] path')].filter(
      (p) => p.getAttribute('stroke-dasharray'),
    )
    expect(dashed).toHaveLength(1)
  })

  test('draws a currency and an instance for the route', () => {
    const { container } = draw([line()])

    expect(container.querySelectorAll('[data-layer="currencies"] > g')).toHaveLength(1)
    expect(container.querySelectorAll('[data-layer="instances"] > g')).toHaveLength(1)
  })

  test('sizes a currency against the busiest one on the same map', () => {
    // Arrange — one route carries nine orders and the other one, in the same
    // scene. The scale is relative: an absolute one lets the leader's glow
    // swallow a continent when the network is busy.
    const lines = [
      ...Array.from({ length: 9 }, (_, i) => line({ orderId: `a${i}` })),
      line({ orderId: 'b', fiat: 'VES', instancePubkey: 'node-ve' }),
    ]

    // Act
    const { container } = draw(lines)
    const radii = [
      ...container.querySelectorAll('[data-layer="currencies"] circle[stroke-opacity]'),
    ].map((c) => Number(c.getAttribute('r')))

    // Assert
    expect(radii).toHaveLength(2)
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii))
  })

  test('gives the busiest market the same size whatever the network volume', () => {
    // A map of a quiet day and a map of a busy one read alike; the figures
    // themselves are in the table, where they can be compared without
    // measuring a circle.
    const quiet = draw([line()])
    const quietR = quiet.container
      .querySelector('[data-layer="currencies"] circle[stroke-opacity]')
      ?.getAttribute('r')
    cleanup()

    const busy = draw(Array.from({ length: 40 }, (_, i) => line({ orderId: `o${i}` })))
    const busyR = busy.container
      .querySelector('[data-layer="currencies"] circle[stroke-opacity]')
      ?.getAttribute('r')

    expect(busyR).toBe(quietR)
  })

  test('draws one traveller per arc', () => {
    const { container } = draw([line(), line({ orderId: 'o2' })])

    expect(container.querySelectorAll('[data-layer="travellers"] circle')).toHaveLength(2)
  })

  test('draws no travellers when motion is not wanted', () => {
    const { container } = draw([line()], true)

    expect(container.querySelector('[data-layer="travellers"]')).toBeNull()
  })

  test('still draws the lines themselves when motion is not wanted', () => {
    const { container } = draw([line()], true)

    expect(container.querySelectorAll('[data-layer="arcs"] path')).toHaveLength(1)
  })

  test('describes itself for a reader who cannot see it', () => {
    const { container } = draw([line()])

    // Singular throughout at a count of one, which is what the catalogue
    // now guarantees and what a screen reader would otherwise stumble on.
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toContain(
      en.map.describe.flows(1, 1, 1),
    )
  })

  test('draws the land it is given', () => {
    const { container } = render(
      <WorldPulse
        scene={sceneOf([])}
        land={[
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 0],
                ],
              ],
            },
          },
        ]}
        projection={projection}
        width={900}
        height={408}
        reducedMotion={false}
        strings={en}
      />,
    )

    expect(container.querySelectorAll('[data-layer="land"] path')).toHaveLength(1)
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
    expect(describeScene(empty, en)).toBe(en.map.describe.empty)
  })

  test('says what it could not place rather than quietly omitting it', () => {
    const scene: Scene = {
      ...empty,
      arcs: [
        {
          orderId: 'a',
          fiat: 'ARS',
          instancePubkey: 'n',
          phase: 'live',
          points: [[0, 0]],
        },
      ],
      unplaced: { currencies: 2, instances: 1 },
    }

    expect(describeScene(scene, en)).toContain(en.map.describe.unplacedCurrencies(2))
    expect(describeScene(scene, en)).toContain(en.map.describe.unplacedInstances(1))
  })
})

describe('WorldPulse · the antimeridian', () => {
  test('breaks a wrapped route rather than streaking it across the map', () => {
    // Arrange — a route from Fiji to Peru: the short way crosses the seam.
    const places: Record<string, LonLat> = { FJD: [178, -18], 'node-pe': [-77, -12] }
    const wrapped: Line = {
      orderId: 'w',
      fiat: 'FJD',
      instancePubkey: 'node-pe',
      phase: 'live',
      updatedAt: 0,
    }
    const scene = buildScene({
      lines: [wrapped],
      currencyAt: (code) => places[code] ?? null,
      instanceAt: (key) => places[key] ?? null,
      instanceLabel: () => '',
      project: projection.project,
    })

    // Act
    const { container } = render(
      <WorldPulse
        scene={scene}
        land={[]}
        projection={projection}
        width={900}
        height={408}
        reducedMotion={false}
        strings={en}
      />,
    )

    // Assert — no single segment spans most of the map.
    const d = container.querySelector('[data-layer="arcs"] path')?.getAttribute('d') ?? ''
    let worst = 0
    for (const sub of d.split('M').filter(Boolean)) {
      const pts = sub.split('L').map((p) => p.split(',').map(Number))
      for (let i = 1; i < pts.length; i++) {
        worst = Math.max(worst, Math.abs((pts[i]?.[0] ?? 0) - (pts[i - 1]?.[0] ?? 0)))
      }
    }
    expect(worst).toBeLessThan(900 * 0.2)
  })
})
